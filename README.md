# DevVault

## HSKChain + Unlock Protocol

DevVault consumes an Unlock **v14** deployment on **HSKChain Testnet (133)** and
**PublicLock v15** memberships paid in native HSK. Access is verified onchain
using `getHasValidKey`; memberships expire after their configured duration.

- Unlock factory: `0x56c7b33a4e06e79E7611787170DA26339E58b4Eb`
- PublicLock template: `0x04D257Fa68fca523B6709E3A5bcbBA57e8518d5B`
- Test membership lock: `0xB212200F82b70d7a93ac3b17eF14E81899d6f2F5`
- RPC: https://testnet.hsk.xyz

The [Unlock fork](https://github.com/Joaquinmes18/unlock/tree/feat/hashkey-testnet)
contains the protocol port and deployment. DevVault contains the product
integration. This is an HSKChain-compatible deployment; official upstream support
is not claimed.

Currently this repository provides a TypeScript/ethers v6 integration library,
wallet switching, a server-side membership guard, and tests. Frontend pages,
backend authentication/storage, and Avalanche functionality remain to be built.

See [HSK integration](docs/HSK_UNLOCK_INTEGRATION.md) for creator/subscriber flows,
API examples, security requirements, deployment addresses, and read-only checks.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm validate:hsk # read-only network validation; no signing keys
```
