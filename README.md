# PlotProof

AI-assisted, farmer-verified deforestation proof for smallholders satellites can't see.

## Structure

```
plotproof/
├── backend/     Anti-spoof plausibility check service (Node/Express)
├── frontend/    Capture flow + dashboard (React/Vite)
└── contracts/   Interface spec for PlotRegistry.sol (you write the contract)
```

## Team split
- **You**: `contracts/` — write `PlotRegistry.sol` against `contracts/INTERFACE_SPEC.md`
- **This build**: `backend/` (anti-spoof checks) + `frontend/` (capture + dashboard)

## Running the backend

```bash
cd backend
npm install
npm start          # listens on :4000
```

Test it directly:
```bash
curl http://localhost:4000/api/health
```

## Running the frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Camera access needs HTTPS on a real phone (localhost is exempt). For testing
on your phone during the hackathon, tunnel it, e.g.:
```bash
npx ngrok http 5173
```

Once your contract is deployed, create `frontend/.env`:
```
VITE_CONTRACT_ADDRESS=0xYourDeployedAddress
VITE_BACKEND_URL=http://localhost:4000
```

## What's already built and tested

- **Backend**: full check pipeline (GPS bounding box, perceptual-hash dedup,
  EXIF consistency, timestamp freshness, glare/bezel/moiré screen-replay
  heuristics, burst-frame parallax check) — verified end-to-end against a
  live server with synthetic test frames, all checks execute and return
  correctly structured verdicts.
- **Frontend**: capture flow (forced live camera, no file upload, burned-in
  freshness code + date overlay, pan-burst capture), verdict display,
  wallet connect + on-chain submission via ethers.js, and a lookup dashboard.

## What's next for you

1. Write and test `PlotRegistry.sol` against `contracts/INTERFACE_SPEC.md`.
2. Deploy to Polygon Amoy testnet, get the address into `frontend/.env`.
3. Run both services together and do a real end-to-end phone test (camera
   permissions and mobile Safari/Chrome quirks are the most likely rough edge).
4. Pre-seed 2–3 plots on-chain and pre-fund the demo wallet before presenting,
   per the proposal's demo-safety plan.
