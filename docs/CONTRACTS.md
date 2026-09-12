# DevVault contract scope

## HSK

DevVault consumes upstream **Unlock v14 / PublicLock v15** deployed on HSKChain
Testnet. Core Solidity is maintained in the
[Unlock fork](https://github.com/Joaquinmes18/unlock/tree/feat/hashkey-testnet).
Our HSK work is configuration, deployment, validation and product integration.
See [the judge guide](JUDGES_HSK_VERIFICATION.md) for exact evidence and sources.

No project-specific Solidity contract currently exists in DevVault. Do not copy
the Unlock monorepo or add dummy contracts to inflate the submission.

## Avalanche

The proposed custom **ContentProofRegistry** is pending. It will be implemented
and reviewed separately in DevVault, after agreeing its requirements. No source,
deployment address, runtime, or completed audit is claimed for it.

Expected future structure (not existing files):

```text
contracts/ContentProofRegistry.sol
test/ContentProofRegistry...
scripts/deploy-content-proof...
```

Choose the Solidity test/deployment toolchain when implementing that contract;
the current project is a TypeScript/ethers integration library, not a Hardhat
contract project. Keep network configuration outside Solidity business logic.

## Standards for future custom contracts

- Pin the Solidity compiler and reproducible optimizer/EVM settings.
- Use clear names, deterministic struct/event fields, and NatSpec for public and
  external functions, including access restrictions and units.
- Use custom errors for contract-specific failures and events for meaningful
  state changes. Validate inputs and integer/unit assumptions explicitly.
- Use explicit ownership/access control; never use `tx.origin` for authorization.
- Follow checks-effects-interactions; minimize external calls, handle failures,
  and review reentrancy at every callback/transfer boundary.
- Avoid arbitrary calls/delegatecalls, unnecessary upgradeability, destructive
  operations and unbounded loops over user-controlled data.
- Use constants/immutables where appropriate. No magic addresses or secrets.
- Test happy paths, access control, invalid inputs, duplicate/replay behavior,
  events, boundary conditions, and any external-call failures.
- Provide a deployment script, separated network config, and exact deployment
  evidence. Never confuse local tests with live deployment validation.

No formal audit, mainnet readiness or production certification is claimed.
