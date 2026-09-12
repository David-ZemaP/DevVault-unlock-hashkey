import {
  BrowserProvider, Contract, Interface, JsonRpcProvider, ZeroAddress, getAddress,
  type Eip1193Provider, type Provider, type TransactionReceipt,
} from 'ethers'
import { HSK_CHAIN_ID, HSK_RPC_URL, HSK_WALLET_NETWORK, UNLOCK_ADDRESS } from './hsk.js'
import { INITIALIZER_ABI, PUBLIC_LOCK_ABI, PURCHASE_SIGNATURE, UNLOCK_ABI } from './abis.js'

const initializer = new Interface(INITIALIZER_ABI)
const unlockInterface = new Interface(UNLOCK_ABI)
let defaultProvider: JsonRpcProvider | undefined

export function getHskProvider(): JsonRpcProvider {
  // Disable short-lived RPC caching, particularly around receipt confirmation.
  return defaultProvider ??= new JsonRpcProvider(HSK_RPC_URL, HSK_CHAIN_ID, { cacheTimeout: -1 })
}

export interface ReadOptions {
  provider?: Provider
  /** Pin post-purchase reads to receipt.blockNumber (or a later confirmed block). */
  blockNumber?: number
}

export async function assertHsk(provider: Provider): Promise<void> {
  if ((await provider.getNetwork()).chainId !== BigInt(HSK_CHAIN_ID)) {
    throw new Error('Expected HSKChain Testnet (133)')
  }
}

/** Call from a user gesture with an injected EIP-1193 wallet; never uses server keys. */
export async function connectHskWallet(wallet: Eip1193Provider): Promise<BrowserProvider> {
  const switchChain = () => wallet.request({
    method: 'wallet_switchEthereumChain', params: [{ chainId: HSK_WALLET_NETWORK.chainId }],
  })
  if (BigInt(await wallet.request({ method: 'eth_chainId' })) !== BigInt(HSK_CHAIN_ID)) {
    try { await switchChain() } catch (error) {
      if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 4902) throw error
      await wallet.request({ method: 'wallet_addEthereumChain', params: [HSK_WALLET_NETWORK] })
      await switchChain()
    }
  }
  if (BigInt(await wallet.request({ method: 'eth_chainId' })) !== BigInt(HSK_CHAIN_ID)) {
    throw new Error('Wallet did not switch to HSKChain Testnet')
  }
  await wallet.request({ method: 'eth_requestAccounts' })
  return new BrowserProvider(wallet, HSK_CHAIN_ID, { cacheTimeout: -1 })
}

export interface CreateMembershipInput {
  creatorAddress: string
  name: string
  durationSeconds: bigint
  priceWei: bigint
  maxMembers: bigint
}

export function encodeMembershipInitializer(input: CreateMembershipInput): string {
  if (!input.name.trim() || input.durationSeconds <= 0n || input.priceWei < 0n || input.maxMembers <= 0n) {
    throw new Error('Name, positive duration/capacity, and nonnegative price are required')
  }
  const creator = getAddress(input.creatorAddress)
  if (creator === ZeroAddress) throw new Error('Creator cannot be zero address')
  return initializer.encodeFunctionData('initialize', [
    creator, input.durationSeconds, ZeroAddress, input.priceWei, input.maxMembers, input.name,
  ])
}

export function extractNewLock(
  logs: ReadonlyArray<{ address: string; topics: ReadonlyArray<string>; data: string }>,
  creatorAddress: string,
): string {
  for (const log of logs) {
    if (getAddress(log.address) !== UNLOCK_ADDRESS) continue
    let event
    try { event = unlockInterface.parseLog(log) } catch { continue }
    if (event?.name === 'NewLock' && getAddress(event.args.lockOwner) === getAddress(creatorAddress)) {
      return getAddress(event.args.newLockAddress)
    }
  }
  throw new Error('Confirmed receipt has no matching Unlock NewLock event')
}

async function confirmed(receipt: TransactionReceipt | null): Promise<TransactionReceipt> {
  if (!receipt || receipt.status !== 1) throw new Error('Transaction was not confirmed successfully')
  return receipt
}

async function signerFor(wallet: Eip1193Provider, expectedAddress: string) {
  const provider = await connectHskWallet(wallet)
  const signer = await provider.getSigner()
  if (getAddress(await signer.getAddress()) !== getAddress(expectedAddress)) {
    throw new Error('Connected wallet does not match the requested account')
  }
  await assertHsk(provider)
  return signer
}

export async function createMembershipLock(input: CreateMembershipInput, wallet: Eip1193Provider) {
  const data = encodeMembershipInitializer(input)
  const signer = await signerFor(wallet, input.creatorAddress)
  const unlock = new Contract(UNLOCK_ADDRESS, UNLOCK_ABI, signer)
  const tx = await unlock['createUpgradeableLockAtVersion(bytes,uint16)'](data, 15)
  const receipt = await confirmed(await tx.wait(1))
  return { lockAddress: extractNewLock(receipt.logs, input.creatorAddress), transactionHash: receipt.hash }
}

export function nativePurchaseArgs(buyerAddress: string) {
  const recipient = getAddress(buyerAddress)
  if (recipient === ZeroAddress) throw new Error('Buyer cannot be zero address')
  return [{ value: 0n, recipient, referrer: ZeroAddress, protocolReferrer: ZeroAddress,
    keyManager: ZeroAddress, data: '0x', additionalPeriods: 0n }]
}

export async function purchaseMembership(
  input: { lockAddress: string; buyerAddress: string }, wallet: Eip1193Provider,
) {
  const args = nativePurchaseArgs(input.buyerAddress)
  const signer = await signerFor(wallet, input.buyerAddress)
  const lock = new Contract(getAddress(input.lockAddress), PUBLIC_LOCK_ABI, signer)
  const [version, token, price, alreadyMember] = await Promise.all([
    lock.publicLockVersion(), lock.tokenAddress(), lock.keyPrice(), lock.getHasValidKey(input.buyerAddress),
  ])
  if (version !== 15n || getAddress(token) !== ZeroAddress) throw new Error('Expected native HSK PublicLock v15')
  if (alreadyMember) throw new Error('Wallet already has a valid membership')
  const tx = await lock[PURCHASE_SIGNATURE](args, { value: price })
  const receipt = await confirmed(await tx.wait(1))
  // Read the state of the confirmed block, never a cached pre-purchase result.
  const active: boolean = await lock.getHasValidKey(input.buyerAddress, { blockTag: receipt.blockNumber })
  return { transactionHash: receipt.hash, blockNumber: receipt.blockNumber, hasMembership: active }
}

export async function hasMembership(
  input: { lockAddress: string; userAddress: string }, options: ReadOptions = {},
): Promise<boolean> {
  const provider = options.provider ?? getHskProvider()
  await assertHsk(provider)
  const lock = new Contract(getAddress(input.lockAddress), PUBLIC_LOCK_ABI, provider)
  return lock.getHasValidKey(getAddress(input.userAddress), { blockTag: options.blockNumber ?? 'latest' })
}

export async function getMembershipInfo(
  input: { lockAddress: string; userAddress: string }, options: ReadOptions = {},
) {
  const provider = options.provider ?? getHskProvider()
  await assertHsk(provider)
  const blockNumber = options.blockNumber ?? await provider.getBlockNumber()
  const lock = new Contract(getAddress(input.lockAddress), PUBLIC_LOCK_ABI, provider)
  const user = getAddress(input.userAddress), at = { blockTag: blockNumber }
  const [name, keyPrice, duration, totalSupply, userBalance, active, version] = await Promise.all([
    lock.name(at), lock.keyPrice(at), lock.expirationDuration(at), lock.totalSupply(at),
    lock.balanceOf(user, at), lock.getHasValidKey(user, at), lock.publicLockVersion(at),
  ])
  return { name: name as string, keyPrice: keyPrice as bigint, duration: duration as bigint,
    totalSupply: totalSupply as bigint, userBalance: userBalance as bigint,
    hasMembership: active as boolean, version: version as bigint, blockNumber }
}
