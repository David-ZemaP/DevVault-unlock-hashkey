# HSKChain Integration — Judge Verification Guide

## What We Did

We brought Unlock's existing membership infrastructure to HSKChain Testnet.
Unlock is the factory, PublicLock contains membership logic, each creator gets a
PublicLock proxy, subscribers pay native HSK, and DevVault checks
`getHasValidKey` to authorize premium access.

The protocol flow has been demonstrated onchain. DevVault currently contains the
Web3 helpers and server guard; frontend pages, authenticated backend routes,
publication storage and Avalanche contracts remain to be implemented. This is an
**HSKChain-compatible Unlock deployment**, not official upstream HSK support.

The following review takes about five minutes with dependencies/artifacts ready.
A cold install/compiler download may take longer. No key, funded wallet, or
transaction is required for verification.

## Step 1 — Inspect Our Actual Code Changes

Open the [Unlock fork](https://github.com/Joaquinmes18/unlock/tree/feat/hashkey-testnet),
branch `feat/hashkey-testnet`. From that repository root:

```sh
git diff e887789c433879649c81045423b5291c7796eba0...feat/hashkey-testnet -- '*.sol'
git diff e887789c433879649c81045423b5291c7796eba0...feat/hashkey-testnet -- packages/networks/src/networks/hashkey-testnet.ts packages/networks/src/networks/index.ts governance/hardhat.hashkey-testnet.config.js HSK_DEPLOYMENT.md
git status --short
```

**Our branch does not modify Unlock/PublicLock Solidity core logic.** The first
diff is empty. The base is the established local `master`/branch merge-base.
Review new uncommitted files directly until they are committed; the three-dot
command only shows committed changes.

Also inspect `governance/scripts/hsk/compile-review.js`, `validate-review.js`,
their test, and [the full source/trust map](https://github.com/Joaquinmes18/unlock/blob/feat/hashkey-testnet/docs/HSK_CONTRACT_REVIEW.md).
The linked new documents will become available on GitHub once the team publishes
the reviewed changes; local paths work now.

## Step 2 — Inspect HSK Network Support

In the fork, `packages/networks/src/networks/hashkey-testnet.ts` defines:

- Chain **133**, RPC **https://testnet.hsk.xyz**.
- Explorer **https://testnet-explorer.hsk.xyz**; native **HSK**, 18 decimals.
- Unlock proxy **0x56c7b33a4e06e79E7611787170DA26339E58b4Eb**.
- PublicLock version **15**; unavailable infrastructure remains unset.

The named export in `packages/networks/src/networks/index.ts` produces the
Hardhat network name **hashkeyTestnet** through the existing network generator.

## Step 3 — Inspect Deployment Tooling

`governance/hardhat.hashkey-testnet.config.js` reuses the official config and
disables automatic explorer verification. This prevents the upstream verification
retry loop from hanging on an unsupported explorer. No shared helper was edited.

`governance/tasks/deploy.js` exposes explicit version parameters. The deployment
used `deploy:unlock --unlock-version 14` and
`deploy:template --public-lock-version 15`, followed by template/config setters.
**Do not execute deployment tasks during review.**

`governance/scripts/deployments/unlock.js` and `publicLock.js` call
`packages/hardhat-helpers/src/upgrades.js`, which copies the packaged versioned
Solidity files and compiles them. Exact tracked sources:

- `packages/contracts/src/contracts/Unlock/UnlockV14.sol`
- `packages/contracts/src/contracts/PublicLock/PublicLockV15.sol`

## Step 4 — Inspect On-Chain Contracts

| Contract | Explorer |
| --- | --- |
| Unlock proxy | [0x56c7b33a4e06e79E7611787170DA26339E58b4Eb](https://testnet-explorer.hsk.xyz/address/0x56c7b33a4e06e79E7611787170DA26339E58b4Eb) |
| Unlock implementation | [0x5451C57dA3A8a3f0f04a74475702501628170211](https://testnet-explorer.hsk.xyz/address/0x5451C57dA3A8a3f0f04a74475702501628170211) |
| PublicLock v15 implementation | [0x04D257Fa68fca523B6709E3A5bcbBA57e8518d5B](https://testnet-explorer.hsk.xyz/address/0x04D257Fa68fca523B6709E3A5bcbBA57e8518d5B) |
| Creator Lock | [0xB212200F82b70d7a93ac3b17eF14E81899d6f2F5](https://testnet-explorer.hsk.xyz/address/0xB212200F82b70d7a93ac3b17eF14E81899d6f2F5) |

Evidence transactions:

- [Unlock deployment](https://testnet-explorer.hsk.xyz/tx/0xa930179977724aff736fd0d8b008983b9d589904d04aa41f50771f46275f5237)
- [PublicLock deployment](https://testnet-explorer.hsk.xyz/tx/0x247d78f91964752cd17f52686e5887aa8a828d330e73f299595f79cad3031248)
- [Template registration](https://testnet-explorer.hsk.xyz/tx/0x8c1450d582b69c3cbd11f1833f4b5c77e79f3bfe7e8302816e1cf546647486c5)
- [Creator Lock creation](https://testnet-explorer.hsk.xyz/tx/0x2348140b9a267dde434b12afa99d99c935a9a729ec8a127fecc99558b468dbb7)
- [Membership purchase](https://testnet-explorer.hsk.xyz/tx/0x04bf5e6f03bf8f6184a6f20bab62aab39007270181c45049709e253376aa2cad)

Explorer source auto-verification was disabled. Independently compare the deployed
implementation runtimes using the next steps rather than relying on an explorer badge.

## Step 5 — Compile the Exact Implementations

With dependencies installed, from the Unlock root:

```sh
corepack yarn workspace @unlock-protocol/types build
corepack yarn workspace @unlock-protocol/networks build
corepack yarn workspace @unlock-protocol/contracts build
corepack yarn workspace @unlock-protocol/hardhat-helpers build
corepack yarn workspace @unlock-protocol/smart-contracts build
cd governance
corepack yarn hardhat run scripts/hsk/compile-review.js --config hardhat.hashkey-testnet.config.js --network hardhat --no-compile
node --test scripts/hsk/validate-review.test.js
```

Expected: packaged/tracked source equality, solc **0.8.21**, optimizer **80 runs**,
EVM **shanghai**, nonempty runtime artifacts: Unlock **17369** bytes and PublicLock
**24175** bytes. The compile script blocks RPC. The shared Hardhat config's
missing `DEPLOYER_PRIVATE_KEY` warning is harmless: do not supply a key.
Use a review shell without fork/ZK/Tenderly flags. The first internal-package
builds can be skipped when already built. No full monorepo/Java build is required.

## Step 6 — Run Read-Only On-Chain Validation

From `unlock/governance`:

```sh
node scripts/hsk/validate-review.js
```

**No private key required. No transaction sent. No chain state modified.**
The script only allows inspection RPC methods and pins reads to a block.

Expected important results:

- `chainId: 133`, `deployment: PASS`.
- Unlock **14**, PublicLock **15**, correct registered template and proxy slots.
- Correct creator-manager role, native token, price, duration, limits, zero hooks.
- `runtimeMatches.Unlock.exact: true` and `runtimeMatches.PublicLock.exact: true`.
- `historicalProof.status: PASS` and a separate current membership status.

Exact full-runtime equality, including metadata, passed at block **33004573**.
It is not an audit. A mismatch fails explicitly and reports compiler/settings and
both hashes. No metadata stripping or version-only substitution is used.

Historical buyer: **0x109697F9b1C8FC31461c4eA42F7F12e99301fCbe**.
Purchase: **0x04bf5e6f03bf8f6184a6f20bab62aab39007270181c45049709e253376aa2cad**.
At block **32998848**, balance **1**, supply **1**, token #1 owner **buyer**, valid
membership **true**, and **0.0001 HSK** received. The receipt includes a mint
`Transfer`, `PaymentReceipt`, and `GNPChanged`.

After the original expiration (**1791776352**, Unix seconds), an unchanged test
key correctly returns false and valid-key balance zero. The script reports
**expired test membership** and preserves historical proof. Changed ownership,
expiry or inconsistent state is distinguished from normal expiration. Archive
RPC failures mean proof could not be checked, not that the contracts failed.

## Step 7 — Verify the DevVault Integration

Inspect these files in this repository:

1. [`lib/web3/hsk.ts`](../lib/web3/hsk.ts): network and deployment constants.
2. [`lib/web3/abis.ts`](../lib/web3/abis.ts): minimal v14/v15 ABIs.
3. [`lib/web3/membership.ts`](../lib/web3/membership.ts): `createMembershipLock`,
   `purchaseMembership`, `hasMembership`, `getMembershipInfo` and wallet switching.
4. [`lib/server/membership-guard.ts`](../lib/server/membership-guard.ts): checks
   current membership **before** calling the premium-content loader.

Purchases use one v15 tuple, native transaction value equal to `keyPrice`, and
`additionalPeriods=0`. Post-purchase reads use the confirmed receipt block.
The guard needs a signature-verified session wallet and a lock from trusted
publication storage; a raw address in a request is not authentication.

The guard/helper implementation is ready. There are no frontend pages or backend
routes yet; do not present those as deployed. No custom Solidity exists here yet;
see [contract scope and future standards](CONTRACTS.md).

## Step 8 — Run DevVault Tests

From the DevVault root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm validate:hsk
```

Local tests cover ABI encoding, event extraction, wallet switching, wrong-chain
rejection, receipt-block reads, fail-closed content loading and expiry handling.
The last command uses read-only RPC, including historical proof. It does not sign.

## How We Implemented It — Step by Step

### 1. HSK did not have this deployment in our Unlock configuration

We added chain 133, its RPC/explorer and native HSK to the existing network system.

### 2. We deployed Unlock

Unlock v14 is the factory/protocol contract, used through its proxy.

### 3. We deployed PublicLock v15

The upstream PublicLock implementation provides membership logic.

### 4. We registered PublicLock v15 inside Unlock

We registered and selected the template for creators to use.

### 5. We created a real creator membership

**HSK Hackathon Creator Membership** costs **0.0001 HSK**, lasts **30 days** and
allows **100** memberships (one key per address).

### 6. We tested with a second wallet

The second wallet paid native HSK through `purchase()`.

### 7. The membership was minted

The confirmed transaction minted token #1 to the buyer.

### 8. We verified access

`getHasValidKey(buyer)` returned true at the confirmed purchase block.

### 9. DevVault consumes that result

Its helpers read onchain state. The frontend can display subscription state;
the backend must independently call the supplied guard before delivering premium
content. Connecting the guard to authenticated product routes remains work to do.

## Guion corto para explicar a los jueces

Para el bounty de HSK no escribimos las membresías desde cero. Tomamos la
infraestructura existente de Unlock Protocol y la desplegamos en HSKChain Testnet,
sin modificar su lógica Solidity.

Primero agregamos la configuración de HSK y adaptamos el deployment. Desplegamos
Unlock v14, que funciona como factory, y PublicLock v15, que contiene la lógica
de membresías. Registramos esa implementación y creamos una membresía real para
un creador.

Después, una segunda wallet pagó 0.0001 HSK por treinta días. La transacción
acuñó el token número uno y comprobamos onchain que getHasValidKey devolvía true.

DevVault ya tiene los helpers y un guard de servidor que verifica la membresía
antes de cargar contenido premium. Falta conectarlos a las pantallas y rutas
autenticadas del producto. Los jueces pueden revisar los contratos, las
transacciones y comparar el bytecode sin usar claves ni enviar transacciones.

## Respuesta de 20 segundos

Portamos y desplegamos Unlock v14 y PublicLock v15 en HSKChain Testnet sin
reescribir sus contratos. Registramos la implementación, creamos una membresía,
la compramos con HSK nativo y verificamos getHasValidKey onchain. DevVault ya tiene
los helpers y el guard de acceso; falta conectarlos al producto completo.

## Preguntas anticipadas

**¿Ustedes escribieron PublicLock?** No. Es lógica upstream de Unlock. Nuestra
contribución es la integración, deployment y validación en HSK, y la integración
de producto.

**¿Entonces qué código es de ustedes?** La configuración HSK, el wrapper de
deployment, los scripts de validación, los helpers Web3 y el guard de DevVault.
El proceso de deployment/registro también es nuestro trabajo. Los contratos
custom de Avalanche siguen pendientes y se revisarán por separado.

**¿Cómo demuestran que funciona?** Direcciones desplegadas, hashes de
transacciones, eventos de mint, validación de lectura, comparación exacta de
bytecode y pruebas locales.

**¿Por qué no hicieron un contrato de membresías propio?** Para no reescribir
innecesariamente lógica compleja de pagos y acceso, y concentrarnos en HSK y el
producto. Reutilizarla no sustituye revisar los riesgos de nuestra configuración.

**¿Dónde está la verificación de acceso?** En
`PublicLock.getHasValidKey(address)`.

**¿El frontend decide el acceso?** No. El backend debe verificar una wallet
autenticada antes de devolver contenido. El guard está implementado; aún falta
conectarlo a rutas y almacenamiento del producto.

**¿Esto es soporte oficial de Unlock para HSK?** No. Es nuestro deployment
compatible con HSK, salvo que upstream lo acepte explícitamente.

**¿La membresía es recurrente automáticamente?** No. La prueba es una membresía
con vencimiento a treinta días, no cobro recurrente automático.

**¿Está auditado o listo para mainnet?** No afirmamos una auditoría de este
deployment ni preparación para producción. El propietario/admin actual es una
wallet de desarrollo; esos permisos son parte del modelo de confianza.
