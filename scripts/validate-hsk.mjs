import assert from 'node:assert/strict'
import { Contract } from 'ethers'
import { UNLOCK_ADDRESS, PUBLIC_LOCK_V15_TEMPLATE, TEST_CREATOR_LOCK } from '../dist/web3/hsk.js'
import { getHskProvider, getMembershipInfo } from '../dist/web3/membership.js'

// Provider only: no wallet, key access, or transaction submission.
const provider = getHskProvider()
try {
  const blockNumber = await provider.getBlockNumber()
  const at = { blockTag: blockNumber }
  const unlock = new Contract(UNLOCK_ADDRESS, [
    'function unlockVersion() view returns (uint16)',
    'function publicLockImpls(uint16) view returns (address)',
  ], provider)
  const lock = new Contract(TEST_CREATOR_LOCK, [
    'function unlockProtocol() view returns (address)',
    'function tokenAddress() view returns (address)',
  ], provider)
  assert.equal(await unlock.unlockVersion(at), 14n)
  assert.equal(await unlock.publicLockImpls(15, at), PUBLIC_LOCK_V15_TEMPLATE)
  assert.equal(await lock.unlockProtocol(at), UNLOCK_ADDRESS)
  assert.equal(await lock.tokenAddress(at), '0x0000000000000000000000000000000000000000')
  const info = await getMembershipInfo({ lockAddress: TEST_CREATOR_LOCK,
    userAddress: '0x109697F9b1C8FC31461c4eA42F7F12e99301fCbe' }, { provider, blockNumber })
  assert.equal(info.version, 15n)
  assert.equal(info.keyPrice, 100000000000000n)
  assert.equal(info.hasMembership, true, 'Historical test membership may have expired; inspect current state')
  console.log(JSON.stringify({ chainId: 133, unlockAddress: UNLOCK_ADDRESS, ...info },
    (_, value) => typeof value === 'bigint' ? value.toString() : value, 2))
} finally { provider.destroy() }
