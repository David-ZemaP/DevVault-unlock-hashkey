import assert from 'node:assert/strict'
import test from 'node:test'
import { membershipStatus } from '../scripts/validate-hsk.mjs'

test('judge validation distinguishes active membership and ordinary expiration', () => {
  assert.equal(membershipStatus({ hasMembership: true, userBalance: 1n }, 100n, 99), 'active test membership')
  assert.equal(membershipStatus({ hasMembership: false, userBalance: 0n }, 100n, 100), 'expired test membership')
  assert.throws(() => membershipStatus({ hasMembership: false, userBalance: 0n }, 100n, 99))
})
