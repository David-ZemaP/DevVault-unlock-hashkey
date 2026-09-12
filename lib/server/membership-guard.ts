import { hasMembership } from '../web3/membership.js'

/** Server only. Supply the lock from trusted publication storage and wallet from
 * a verified authentication session, never from unchecked request parameters. */
export function createMembershipGuard(verify = hasMembership) {
  async function canAccessPremiumContent(input: { lockAddress: string; walletAddress: string }) {
    return verify({ lockAddress: input.lockAddress, userAddress: input.walletAddress })
  }

  async function loadPremiumContent<T>(input: {
    lockAddress: string
    authenticatedWalletAddress: string
    load: () => Promise<T>
  }): Promise<T> {
    const allowed = await canAccessPremiumContent({
      lockAddress: input.lockAddress, walletAddress: input.authenticatedWalletAddress,
    })
    if (!allowed) throw new Error('Membership required')
    // RPC errors propagate: content is not loaded when verification fails.
    return input.load()
  }

  return { canAccessPremiumContent, loadPremiumContent }
}

export const { canAccessPremiumContent, loadPremiumContent } = createMembershipGuard()
