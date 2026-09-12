# HSKChain + Unlock integration

## Repository responsibilities and current architecture

The [Unlock Protocol HSK port](https://github.com/Joaquinmes18/unlock), branch
`feat/hashkey-testnet`, contains the protocol configuration and deployment.
DevVault consumes those contracts. Do not copy the Unlock monorepo or redeploy the
protocol from this application repository.

At integration time DevVault contained only a README and two workflows. There
was no frontend framework, backend, wallet provider, database, TypeScript setup,
or Avalanche implementation. This change introduces an isolated TypeScript
library using ethers **6.15.0**, consistent with the protocol fork, and pnpm as
already selected by the workflows. It does not invent a product schema or UI.

`lib/web3` is usable by the future frontend and backend. `lib/server` belongs only
in backend code. Workflow `contracts.yml` now checks the integration; `deploy.yml`
is manual, read-only validation. Actual deployment remains in the protocol fork.

## Network and deployments

| Setting | Value |
| --- | --- |
| Chain | HSKChain Testnet, **133** (`0x85`) |
| RPC | https://testnet.hsk.xyz |
| Explorer | https://testnet-explorer.hsk.xyz |
| Currency | HSK, 18 decimals |
| Unlock v14 proxy | `0x56c7b33a4e06e79E7611787170DA26339E58b4Eb` |
| Unlock implementation | `0x5451C57dA3A8a3f0f04a74475702501628170211` |
| PublicLock v15 template | `0x04D257Fa68fca523B6709E3A5bcbBA57e8518d5B` |
| Test creator lock | `0xB212200F82b70d7a93ac3b17eF14E81899d6f2F5` |

Public constants live in `lib/web3/hsk.ts`. Minimal human-readable ethers ABIs
live in `lib/web3/abis.ts`; no protocol contracts or large ABI packages are copied.
No environment variables or server signing keys are needed for this library.

This is an **HSKChain-compatible Unlock deployment**, not a claim of official
upstream support. No Locksmith or subgraph is required for the membership proof.

## Creator flow

1. The creator authenticates and drafts a publication.
2. Collect name, price and duration; convert HSK using `parseEther` (never float
   arithmetic) and use bigint for contract integers.
3. On a user gesture, call `createMembershipLock(input, injectedWallet)`.
4. Save the returned `lockAddress` with the publication in the future backend.
   Validate creator ownership and the onchain `NewLock` event before accepting
   a publication/lock association. Do not trust arbitrary client-supplied locks.

```ts
import { parseEther, type Eip1193Provider } from 'ethers'
import { createMembershipLock } from '../lib/web3/membership.js'

// injectedWallet is the EIP-1193 provider from your wallet connector.
async function create(creatorAddress: string, injectedWallet: Eip1193Provider) {
  return createMembershipLock({
    creatorAddress,
    name: 'DevVault Membership',
    durationSeconds: 2592000n,
    priceWei: parseEther('0.0001'),
    maxMembers: 100n,
  }, injectedWallet)
}
```

This is a transaction-producing API: invoke only after a deliberate creator
action. It switches/adds HSKChain, checks the signer matches the creator, encodes
`initialize(address,uint256,address,uint256,uint256,string)` with native currency
represented by the zero address, and calls
`createUpgradeableLockAtVersion(bytes,uint16)` with version **15**. The result is
`{ lockAddress, transactionHash }`, extracted from the factory's `NewLock` event.
`receipt.contractAddress` is not used.

## Subscriber flow

1. Return only public preview content to unauthenticated/nonmember users.
2. Connect the user's wallet and use `hasMembership({ lockAddress, userAddress })`.
3. If false, offer Subscribe. On user confirmation call
   `purchaseMembership({ lockAddress, buyerAddress }, injectedWallet)`.
4. The helper checks HSK chain/account, version 15 and native currency, reads
   `keyPrice()`, and submits exactly one tuple:

```ts
{
  value: 0n,
  recipient: buyerAddress,
  referrer: ZeroAddress,
  protocolReferrer: ZeroAddress,
  keyManager: ZeroAddress,
  data: '0x',
  additionalPeriods: 0n,
}
```

The overload is
`purchase((uint256,address,address,address,address,bytes,uint256)[])`.
Transaction value equals the current price. The tuple's `value` is for ERC-20
accounting and is zero for native HSK; `additionalPeriods: 0` buys one period.
This is a paid, expiring membership, not automatic recurring billing.

5. The helper waits for one confirmation and returns
   `{ transactionHash, blockNumber, hasMembership }`. Membership is re-read at
   the receipt's explicit block. Default RPC caching is disabled.
6. If that result is false, do not automatically purchase again: display the
   transaction hash and refresh state. If a confirmed transaction's state read
   fails, check its receipt before offering a retry to avoid duplicate payments.
7. Request premium content from the backend, which must independently recheck
   current membership against a verified wallet session.

Use `hasMembership(input, { blockNumber })` to repeat a receipt-block read. Use
`getMembershipInfo({ lockAddress, userAddress })` for name, bigint price/duration,
supply, user balance, validity, version, and the snapshot block number. Convert
bigint values to strings when returning JSON. Never grant server access using a
historical block or the client's claimed membership result.

For UI wallet support, `connectHskWallet` uses `wallet_switchEthereumChain`, adds
HSK on error 4902, switches again and checks chain 133, then requests accounts.
User rejection propagates. React/wagmi adapters can pass their EIP-1193 connector
provider; no separate wallet framework is required by this library.

## Server-side access guard

`canAccessPremiumContent({ lockAddress, walletAddress })` performs read-only
`getHasValidKey` against HSK. It does not authenticate a wallet address.

`loadPremiumContent` delays even loading the premium payload until that check
passes, and propagates RPC errors without loading content:

```ts
import { loadPremiumContent } from '../lib/server/membership-guard.js'

// Inside a future authenticated backend route:
// 1. Verify a wallet signature/session (nonce, domain, expiry, replay protection).
// 2. Resolve the publication and its lock from trusted server-side storage.
// 3. Never take authenticatedWalletAddress or authorization lock from request body.
const content = await loadPremiumContent({
  lockAddress: publication.lockAddress,
  authenticatedWalletAddress: verifiedSession.walletAddress,
  load: () => publicationStore.loadPremiumBody(publication.id),
})
// Return content only here, with private/no-store caching.
```

The session and publication store above are integration points, not implemented
models. Return 403 for membership denial; treat RPC failure as a service error
without content. Do not put premium bodies in public APIs, initial HTML, static
assets, shared caches, or client bundles and then merely hide them with CSS.

Backend routes, wallet authentication, publication persistence, and frontend
pages remain to be built. Avalanche integration is also still absent.

## Validation and historical proof

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm validate:hsk
```

`test` builds the library and uses local mocks only. `validate:hsk` performs only
read-only RPC calls, verifies Unlock v14, template and lock association, native
currency, v15, price, and test-buyer membership at one fresh block. It never loads
private keys or sends transactions. Network failures fail validation explicitly.

Historical proof:

- Buyer: `0x109697F9b1C8FC31461c4eA42F7F12e99301fCbe`
- Purchase: `0x04bf5e6f03bf8f6184a6f20bab62aab39007270181c45049709e253376aa2cad`
- Purchase block: **32998848**; token #1 minted, balance/supply **1**, membership
  **true**. Price **0.0001 HSK**, duration **30 days**.
- The legacy purchase's empty `_values` was valid for native HSK. Reported zero
  state was contradicted by receipt-block reads; do not infer failure from a
  stale post-purchase read or automatically charge again.

The live proof assertion will eventually fail when the test membership expires;
investigate expiry instead of assuming the deployment is broken.

Generated `dist/` and `node_modules/` are ignored. Commit sources, tests,
documentation, workflow changes and `pnpm-lock.yaml`. Do not store private keys,
seed phrases, or real `.env` files. No deployment secrets belong in DevVault CI.
