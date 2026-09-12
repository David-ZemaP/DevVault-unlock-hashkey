# DevVault — Unlock Protocol Infrastructure Engine (HashKey Chain)

This repository serves as the **Infrastructure and Protocol Engine** for the DevVault ecosystem. It manages the deployed Unlock Protocol smart contracts on **HashKey Chain Testnet (Chain ID 133)** and provides a typed TypeScript/ethers v6 client library and server guard.

The customer-facing application, UI, and Avalanche provenance layer live in the sibling repository: [`DevVault-Creator_Platform`](../DevVault-Creator_Platform).

---

## Quick Judge & Verification Guide

For a rapid evaluation of the live HashKey integration, start with the [Judge Verification Guide](docs/JUDGES_HSK_VERIFICATION.md).
It links to the [Unlock fork](https://github.com/Joaquinmes18/unlock/tree/feat/hashkey-testnet) and [Contract Review Guide](https://github.com/Joaquinmes18/unlock/blob/feat/hashkey-testnet/docs/HSK_CONTRACT_REVIEW.md).

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm validate:hsk
```

These checks require no private keys or gas and send no mutating transactions. The live check separates historical purchase proof from current membership expiration.

---

## Network & Deployment Details

| Setting | Value |
| --- | --- |
| **Network** | HSKChain Testnet |
| **Chain ID** | `133` (`0x85`) |
| **RPC URL** | https://testnet.hsk.xyz |
| **Block Explorer** | https://testnet-explorer.hsk.xyz |
| **Currency** | Native HSK (18 decimals) |
| **Unlock Factory (v14)** | `0x56c7b33a4e06e79E7611787170DA26339E58b4Eb` |
| **Unlock Implementation** | `0x5451C57dA3A8a3f0f04a74475702501628170211` |
| **PublicLock Template (v15)**| `0x04D257Fa68fca523B6709E3A5bcbBA57e8518d5B` |
| **Test Creator Lock** | `0xB212200F82b70d7a93ac3b17eF14E81899d6f2F5` |

Protocol configuration and contract deployments are ported via the [Unlock Protocol HSK fork](https://github.com/Joaquinmes18/unlock/tree/feat/hashkey-testnet). This repository consumes those deployments without duplicating the Unlock monorepo.

---

## How `DevVault-Creator_Platform` Interacts with this Engine

`DevVault-Creator_Platform` consumes the exports of this repository across both the frontend and backend:

```text
┌─────────────────────────────────────────────────────────────┐
│                 DevVault-Creator_Platform                   │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
        (1) Client Purchases            (2) Server Verification
               │                               │
               ▼                               ▼
    ┌──────────────────────┐        ┌──────────────────────┐
    │  lib/web3/membership │        │  lib/server/guard    │
    │  • purchaseMembership│        │  • getHasValidKey    │
    │  • createLock        │        │  • checkAccess       │
    └──────────┬───────────┘        └──────────┬───────────┘
               │                               │
               └───────────────┬───────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │         HashKey Chain Testnet (133)          │
        │      Unlock Factory & PublicLock v15         │
        └──────────────────────────────────────────────┘
```

1. **Creator Lock Creation**:
   The creator platform triggers `createMembershipLock()` with an EIP-1193 injected provider to instantiate a new `PublicLock v15` with creator-defined price and duration.
2. **Subscriber Key Purchase**:
   When purchasing access, the buyer triggers `purchaseMembership()`, submitting native HSK to the lock contract on HashKey Chain.
3. **Backend Membership Guard**:
   The consumer platform backend calls `checkAccess()` / `getHasValidKey()` over HashKey RPC to verify active onchain access before serving protected content or issuing signed download tokens.

---

## Repository Structure

```text
.
├── docs/
│   ├── CONTRACTS.md               # Contract scope and architecture boundary
│   ├── HSK_UNLOCK_INTEGRATION.md  # Comprehensive integration guide & specifications
│   └── JUDGES_HSK_VERIFICATION.md # Step-by-step verification guide for hackathon judges
├── lib/
│   ├── web3/
│   │   ├── abis.ts                # Minimal human-readable ABIs (Unlock & PublicLock)
│   │   ├── hsk.ts                 # Chain parameters and deployed contract addresses
│   │   └── membership.ts          # Ethers v6 transaction helpers & read functions
│   └── server/
│       └── membership-guard.ts    # Read-only server-side access verification
├── scripts/
│   └── validate-hsk.mjs           # Live onchain network validation script
└── test/
    ├── hsk-validation.test.mjs    # Expiration vs historical proof test suite
    └── membership.test.mjs        # Integration tests against local and testnet states
```

---

## Development & Validation

### Install Dependencies

```bash
corepack pnpm install --frozen-lockfile
```

### Type Checking & Linting

```bash
corepack pnpm typecheck
corepack pnpm lint
```

### Run Tests

```bash
corepack pnpm test
```

### Validate Live HashKey Testnet Connectivity

Runs a read-only query directly against HashKey Testnet to verify contract presence, template binding, and active membership verification:

```bash
corepack pnpm validate:hsk
```
