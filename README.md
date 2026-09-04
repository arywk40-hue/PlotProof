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

The browser sends a 7-frame camera pan to `POST /api/check`. The API accepts at most 12 image frames, each at most 15 MB, and rejects non-image MIME types. `REJECTED` and `FLAGGED` verdicts receive no IPFS CID. The UI both hides the contract action for `FLAGGED` evidence and has a second eligibility guard before any wallet or contract call.

The current Sepolia contract and deployment transaction are documented in [the interface specification](contracts/INTERFACE_SPEC.md). The root workflow at `.github/workflows/test.yml` runs format, build, and Foundry tests inside `contracts/`.

## Production handoff requirements

Before sign-off, the project owner must configure a hosted backend URL, backend secrets (`PINATA_JWT`, durable database path/backup policy), a hosted frontend deployment, and a real Sepolia RPC provider. Then perform and record a live run: camera capture → API → IPFS CID → wallet transaction → dashboard lookup. Record its transaction hash and CID in [the E2E evidence record](docs/E2E_RUN.md).

The legal and operating items required for a signing-ready agreement are tracked in [the handoff checklist](docs/HANDOFF_AND_SIGNOFF.md).
