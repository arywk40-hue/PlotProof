# PlotRegistry.sol — Interface Spec

This is the contract interface the frontend (`src/lib/config.js`, `src/lib/chain.js`)
already codes against. Build `PlotRegistry.sol` to match this exactly and the
frontend needs zero changes — just drop in the deployed address + ABI.

## State

```solidity
struct Plot {
    address submitter;
    int256 lat;       // fixed-point, degrees * 1e6 (frontend scales for you)
    int256 lon;       // fixed-point, degrees * 1e6
    uint256 timestamp; // block.timestamp at submission
    bool exists;
}

mapping(bytes32 => Plot) public plots;         // photoHash => Plot
mapping(address => uint256) public rewardBalance;
```

## Functions

```solidity
function submitPlot(bytes32 photoHash, int256 lat, int256 lon) external {
    require(!plots[photoHash].exists, "Plot already submitted");
    plots[photoHash] = Plot(msg.sender, lat, lon, block.timestamp, true);
    rewardBalance[msg.sender] += 1; // or a fixed token amount, TBD by team

    emit PlotVerified(photoHash, msg.sender, lat, lon, block.timestamp);
}

function getPlot(bytes32 photoHash) external view returns (
    address submitter,
    int256 lat,
    int256 lon,
    uint256 timestamp,
    bool exists
) {
    Plot memory p = plots[photoHash];
    return (p.submitter, p.lat, p.lon, p.timestamp, p.exists);
}
```

## Events

```solidity
event PlotVerified(
    bytes32 indexed photoHash,
    address indexed submitter,
    int256 lat,
    int256 lon,
    uint256 timestamp
);
```

## Notes / gotchas to test for

- **Duplicate hash guard**: reject a second `submitPlot()` call with a hash
  already in `plots`. This is your on-chain backstop against replay even if
  the off-chain dedup check is somehow bypassed.
- **photoHash must be `keccak256` of the raw image bytes**, not a re-hash or
  ABI-encoded wrapper. Frontend computes this with `ethers.keccak256(bytes)` —
  test your contract against a hash produced that exact way, not a hash from
  a different tool, or the demo lookup will silently mismatch.
- **lat/lon are fixed-point ints scaled by 1e6** (frontend does `Math.round(lat * 1e6)`
  before calling). Don't add extra scaling on the contract side.
- Deploy to **Polygon Amoy testnet** (chainId `80002`). Frontend's
  `AMOY_CHAIN` config in `src/lib/config.js` already points there.
- Once deployed, put the address in `frontend/.env`:
  ```
  VITE_CONTRACT_ADDRESS=0xYourDeployedAddress
  VITE_BACKEND_URL=http://localhost:4000
  ```

## Suggested Hardhat test checklist

- [ ] `submitPlot` stores correct submitter, lat, lon, timestamp
- [ ] `submitPlot` emits `PlotVerified` with correct args
- [ ] `submitPlot` reverts on duplicate `photoHash`
- [ ] `rewardBalance` increments correctly per submitter (not per plot globally)
- [ ] `getPlot` on a non-existent hash returns `exists == false`, doesn't revert
- [ ] Gas cost of `submitPlot` is reasonable (check with `hardhat-gas-reporter`)
