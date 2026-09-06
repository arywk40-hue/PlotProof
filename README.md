# PlotProof

PlotProof captures **live camera evidence** from a smallholder, runs anti-spoof checks, pins only verified evidence to IPFS, and anchors the verified record on the `Farmer` contract.

## Current implementation status

The contract is deployed on **Ethereum Sepolia**, which is the implemented target network for this repository (not Polygon Amoy).

| Deliverable | Status |
| --- | --- |
| `Farmer` contract deployment | Completed on Sepolia at `0x7f428d2f983a646d4a12b8259cf6f1c77a56e33a`; frontend integration is environment-configured |
| Live camera capture | Implemented; there is no file-upload flow in the UI |
| Anti-spoof API and IPFS pinning | Implemented; only `VERIFIED` evidence receives a CID |
| Automated tests | Backend API and frontend eligibility tests included; Foundry tests run in root CI |
| Hosted deployment / live E2E proof | Pending owner credentials, hosting, and a recorded transaction/CID |

## Repository layout

```
backend/     Express anti-spoof API, SQLite duplicate history, Pinata upload
frontend/    React/Vite live-camera capture and on-chain lookup UI
contracts/   Farmer.sol, Foundry tests, deployment receipt and interface spec
```

## Local development

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm start
```

The backend requires Node.js 22.5+ for its SQLite persistence layer. `PINATA_JWT` is required when a submission reaches `VERIFIED`. Obtain a JWT with file-upload permission in the Pinata dashboard and keep it only in the backend host's secret manager or local `.env`; never expose it in Vite variables. `PLOTPROOF_DB_PATH` defaults to `data/plotproof.sqlite`, providing duplicate-history persistence across server restarts.

Run automated checks:

```bash
cd backend
npm test
```

To perform the real Pinata integration check (upload a sample PNG and request it through the Pinata gateway), set `PINATA_JWT` and run:

```bash
npm run test:integration
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

All three frontend variables are required at startup. There are deliberately no `localhost`, public-RPC, or zero-address fallbacks:

```dotenv
VITE_BACKEND_URL=https://your-hosted-backend.example.com
VITE_CONTRACT_ADDRESS=0x7f428d2f983a646d4a12b8259cf6f1c77a56e33a
VITE_SEPOLIA_RPC_URL=https://your-sepolia-rpc-provider.example.com
```

For a phone, camera and location permissions need HTTPS (localhost is exempt). The client is live camera capture only; it does not accept a saved image file.

```bash
cd frontend
npm test
npm run build
```

## Verification and chain behavior

The browser sends a 7-frame camera pan to `POST /api/check`. The API accepts at most 12 image frames, each at most 15 MB, and rejects non-image MIME types. The current pilot location rules support Indonesia's oil-palm regions and an India-wide field-testing region; replace these coarse boxes with approved plot-level boundaries before a production rollout. `REJECTED` and `FLAGGED` verdicts receive no IPFS CID. The UI both hides the contract action for `FLAGGED` evidence and has a second eligibility guard before any wallet or contract call.

The current Sepolia contract and deployment transaction are documented in [the interface specification](contracts/INTERFACE_SPEC.md). The root workflow at `.github/workflows/test.yml` runs format, build, and Foundry tests inside `contracts/`.

## Production handoff requirements

Before sign-off, the project owner must configure a hosted backend URL, backend secrets (`PINATA_JWT`, durable database path/backup policy), a hosted frontend deployment, and a real Sepolia RPC provider. Then perform and record a live run: camera capture → API → IPFS CID → wallet transaction → dashboard lookup. Record its transaction hash and CID in [the E2E evidence record](docs/E2E_RUN.md).

The legal and operating items required for a signing-ready agreement are tracked in [the handoff checklist](docs/HANDOFF_AND_SIGNOFF.md).

## Render backend and Vercel frontend

Import the root `render.yaml` Blueprint and enter `PINATA_JWT` and
`FRONTEND_ORIGIN` manually in Render. Use the exact Vercel origin without a
trailing slash. Local development defaults to `http://localhost:5173`;
if opening Vite at `http://127.0.0.1:5173`, set that exact origin instead.
The Blueprint includes a persistent disk for SQLite and therefore needs a paid
Render service. It pins Node 22.5.0 and enables its experimental SQLite flag.
No service has been provisioned by adding this file.

Set Vercel's three `VITE_*` values in its dashboard, including the HTTPS Render
backend URL, and rebuild the frontend. Before the demo, open
`https://YOUR-BACKEND/health`. A 200 response confirms the process is awake;
it does not test Pinata or database readiness.

RPC reads retry transient rate-limit/timeouts three times (1s, 2s, 4s).
Confirmation waits up to three minutes per attempt, with one transient retry.
The UI displays retry progress and preserves the transaction hash on failure.
Only reads/confirmation are retried; sending a transaction is attempted once.

## Container deployment

The repository includes production Dockerfiles and a Compose stack. Copy the deployment template, fill in real hosted URLs and credentials, then start the stack:

```bash
cp .env.deploy.example .env.deploy
docker compose --env-file .env.deploy up --build -d
```

The backend persists SQLite data in the `plotproof-data` Docker volume. Back up that volume or replace the store with a managed database before production use. The frontend is served at port `8080`; the backend is served at port `4000`. For a public deployment, set `VITE_BACKEND_URL` to the HTTPS URL that browsers can reach (usually an API subdomain or reverse-proxy path), not an internal Docker hostname.

### What happens to accepted evidence

Only a `VERIFIED` verdict is accepted. The backend pins the middle live-capture frame to Pinata and returns its CID. The UI then enables **Record on-chain**; after the user approves the Sepolia wallet transaction, the `Farmer` contract stores the location, CID, timestamp, and raw-image keccak256 hash, while increasing the submitter's reward point balance. A `FLAGGED` or `REJECTED` result is never pinned or sent to the contract.
