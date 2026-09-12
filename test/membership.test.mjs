import assert from 'node:assert/strict'
import test from 'node:test'
import { Interface, JsonRpcProvider, ZeroAddress } from 'ethers'
import { INITIALIZER_ABI, PUBLIC_LOCK_ABI, PURCHASE_SIGNATURE, UNLOCK_ABI } from '../dist/web3/abis.js'
import { UNLOCK_ADDRESS, TEST_CREATOR_LOCK } from '../dist/web3/hsk.js'
import { connectHskWallet, encodeMembershipInitializer, extractNewLock, nativePurchaseArgs,
  hasMembership, getMembershipInfo } from '../dist/web3/membership.js'
import { createMembershipGuard } from '../dist/server/membership-guard.js'

const buyer = '0x109697F9b1C8FC31461c4eA42F7F12e99301fCbe'

test('initializer preserves native currency, wei, creator, and duration', () => {
  const data = encodeMembershipInitializer({ creatorAddress: buyer, name: 'Membership',
    durationSeconds: 2592000n, priceWei: 100000000000000n, maxMembers: 100n })
  const decoded = new Interface(INITIALIZER_ABI).decodeFunctionData('initialize', data)
  assert.deepEqual([...decoded], [buyer, 2592000n, ZeroAddress, 100000000000000n, 100n, 'Membership'])
  assert.throws(() => encodeMembershipInitializer({ creatorAddress: buyer, name: 'x',
    durationSeconds: 0n, priceWei: 1n, maxMembers: 100n }))
})

test('tuple ABI encodes exactly one native membership period', () => {
  const iface = new Interface(PUBLIC_LOCK_ABI)
  const data = iface.encodeFunctionData(PURCHASE_SIGNATURE, [nativePurchaseArgs(buyer)])
  const [args] = iface.decodeFunctionData(PURCHASE_SIGNATURE, data)
  assert.equal(args.length, 1)
  assert.deepEqual([...args[0]], [0n, buyer, ZeroAddress, ZeroAddress, ZeroAddress, '0x', 0n])
})

test('NewLock extraction accepts only factory events with the expected creator', () => {
  const iface = new Interface(UNLOCK_ABI)
  const event = iface.encodeEventLog(iface.getEvent('NewLock'), [buyer, TEST_CREATOR_LOCK])
  const spoofed = { ...event, address: TEST_CREATOR_LOCK }
  assert.throws(() => extractNewLock([spoofed], buyer))
  assert.equal(extractNewLock([spoofed, { ...event, address: UNLOCK_ADDRESS }], buyer), TEST_CREATOR_LOCK)
  assert.throws(() => extractNewLock([{ ...event, address: UNLOCK_ADDRESS }], ZeroAddress))
})

test('wallet adds unknown HSK network, switches, and requests accounts', async () => {
  let chain = '0x1', added = false
  const methods = []
  const wallet = { async request({ method, params }) {
    methods.push(method)
    if (method === 'eth_chainId') return chain
    if (method === 'wallet_addEthereumChain') {
      assert.equal(params[0].chainId, '0x85'); added = true; return null
    }
    if (method === 'wallet_switchEthereumChain') {
      if (!added) throw { code: 4902 }
      chain = '0x85'; return null
    }
    if (method === 'eth_requestAccounts') return [buyer]
    throw new Error(`Unexpected wallet call: ${method}`)
  } }
  const provider = await connectHskWallet(wallet)
  assert.equal(chain, '0x85')
  assert.equal(methods.filter(m => m === 'wallet_switchEthereumChain').length, 2)
  provider.destroy()
})

test('wallet cancellation is propagated without adding a network', async () => {
  await assert.rejects(connectHskWallet({ async request({ method }) {
    if (method === 'eth_chainId') return '0x1'
    if (method === 'wallet_switchEthereumChain') throw new Error('User rejected')
    throw new Error('Must not add chain')
  } }), /User rejected/)
})

class ReadOnlyProvider extends JsonRpcProvider {
  calls = []
  chain = '0x85'
  constructor() { super('http://unused.invalid', 133, { cacheTimeout: -1 }) }
  async _send(payload) {
    const iface = new Interface(PUBLIC_LOCK_ABI)
    return (Array.isArray(payload) ? payload : [payload]).map(p => {
      this.calls.push(p)
      let result
      if (p.method === 'eth_chainId') result = this.chain
      else if (p.method === 'eth_call') {
        assert.equal(p.params[0].to.toLowerCase(), TEST_CREATOR_LOCK.toLowerCase())
        const f = iface.parseTransaction({ data: p.params[0].data })
        const values = { getHasValidKey: true, name: 'Membership', keyPrice: 100000000000000n,
          expirationDuration: 2592000n, totalSupply: 1n, balanceOf: 1n, publicLockVersion: 15n }
        result = iface.encodeFunctionResult(f.fragment, [values[f.name]])
      } else throw new Error(`Forbidden RPC in read-only helper: ${p.method}`)
      return { id: p.id, jsonrpc: '2.0', result }
    })
  }
}

test('membership reads use the supplied confirmed block and never send transactions', async () => {
  const provider = new ReadOnlyProvider()
  try {
    const input = { lockAddress: TEST_CREATOR_LOCK, userAddress: buyer }
    assert.equal(await hasMembership(input, { provider, blockNumber: 123 }), true)
    const info = await getMembershipInfo(input, { provider, blockNumber: 123 })
    assert.equal(info.version, 15n)
    assert.equal(info.hasMembership, true)
    assert.equal(info.keyPrice, 100000000000000n)
    assert(provider.calls.filter(p => p.method === 'eth_call').every(p => p.params[1] === '0x7b'))
  } finally { provider.destroy() }
})

test('wrong chain fails closed', async () => {
  const provider = new ReadOnlyProvider()
  provider.chain = '0x1'
  try {
    await assert.rejects(hasMembership({ lockAddress: TEST_CREATOR_LOCK, userAddress: buyer }, { provider }))
    assert.equal(provider.calls.filter(p => p.method === 'eth_call').length, 0)
  } finally { provider.destroy() }
})

test('server loads premium content only after successful membership verification', async () => {
  for (const mode of ['denied', 'rpc-error', 'allowed']) {
    let loaded = false
    const guard = createMembershipGuard(async () => {
      assert.equal(loaded, false)
      if (mode === 'rpc-error') throw new Error('RPC unavailable')
      return mode === 'allowed'
    })
    const operation = guard.loadPremiumContent({ lockAddress: TEST_CREATOR_LOCK,
      authenticatedWalletAddress: buyer, load: async () => { loaded = true; return 'premium' } })
    if (mode === 'allowed') assert.equal(await operation, 'premium')
    else await assert.rejects(operation)
    assert.equal(loaded, mode === 'allowed')
  }
})
