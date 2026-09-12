import assert from 'node:assert/strict'
import { Contract } from 'ethers'
import { fileURLToPath } from 'node:url'
import { UNLOCK_ADDRESS, PUBLIC_LOCK_V15_TEMPLATE, TEST_CREATOR_LOCK } from '../dist/web3/hsk.js'
import { getHskProvider, getMembershipInfo } from '../dist/web3/membership.js'

// Normal expiration must not invalidate the historical purchase proof.
export function membershipStatus(info, expiration, timestamp) {
  const expired = expiration <= BigInt(timestamp)
  assert.equal(info.hasMembership, !expired, 'Validity disagrees with expiration')
  assert.equal(info.userBalance, expired ? 0n : 1n)
  return expired ? 'expired test membership' : 'active test membership'
}

// Provider only: no wallet, key access, or transaction submission.
async function main() {
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
      'function keyExpirationTimestampFor(uint256) view returns (uint256)',
      'function ownerOf(uint256) view returns (address)',
    ], provider)
    assert.equal(await unlock.unlockVersion(at), 14n)
    assert.equal(await unlock.publicLockImpls(15, at), PUBLIC_LOCK_V15_TEMPLATE)
    assert.equal(await lock.unlockProtocol(at), UNLOCK_ADDRESS)
    assert.equal(await lock.tokenAddress(at), '0x0000000000000000000000000000000000000000')
    const info = await getMembershipInfo({ lockAddress: TEST_CREATOR_LOCK,
      userAddress: '0x109697F9b1C8FC31461c4eA42F7F12e99301fCbe' }, { provider, blockNumber })
    assert.equal(info.version, 15n)
    assert.equal(info.keyPrice, 100000000000000n)
    const buyer = '0x109697F9b1C8FC31461c4eA42F7F12e99301fCbe'
    const receipt = await provider.getTransactionReceipt('0x04bf5e6f03bf8f6184a6f20bab62aab39007270181c45049709e253376aa2cad')
    assert(receipt && receipt.status === 1, 'Successful historical purchase receipt required')
    assert.equal(receipt.to, TEST_CREATOR_LOCK)
    assert.equal(receipt.from, buyer)
    const historical = await getMembershipInfo({ lockAddress: TEST_CREATOR_LOCK, userAddress: buyer },
      { provider, blockNumber: receipt.blockNumber })
    assert.equal(historical.hasMembership, true)
    assert.equal(historical.userBalance, 1n)
    assert.equal(historical.totalSupply, 1n)
    assert.equal(await lock.ownerOf(1, { blockTag: receipt.blockNumber }), buyer)
    assert.equal(await lock.ownerOf(1, at), buyer, 'Current test token ownership changed')
    const expiration = await lock.keyExpirationTimestampFor(1, at)
    const originalExpiration = await lock.keyExpirationTimestampFor(1, { blockTag: receipt.blockNumber })
    const block = await provider.getBlock(blockNumber)
    assert(block, 'Snapshot block unavailable')
    const status = membershipStatus(info, expiration, block.timestamp)
    console.log(JSON.stringify({ historicalProof: 'PASS', purchaseBlock: receipt.blockNumber,
      currentMembershipStatus: expiration === originalExpiration ? status : 'test membership expiration changed; inspect extension/cancellation',
      expiration: expiration.toString() }))
    console.log(JSON.stringify({ chainId: 133, unlockAddress: UNLOCK_ADDRESS, ...info },
      (_, value) => typeof value === 'bigint' ? value.toString() : value, 2))
  } finally { provider.destroy() }

}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
