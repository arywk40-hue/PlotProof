# Farmer contract interface and deployment record

## Implemented network

The canonical implementation in this repository is `Farmer.sol`, deployed to **Ethereum Sepolia** (chain ID `11155111`), not Polygon Amoy.

- Contract: `Farmer`
- Address: `0x7f428d2f983a646d4a12b8259cf6f1c77a56e33a`
- Deployment transaction: `0xd8636f05ca7e73e704ab8f89bed5060b8dbbf4caefd88a626e239fc4584dc12e`
- Deployment receipt: `broadcast/Farmer.s.sol/11155111/run-latest.json`

The frontend requires this address through `VITE_CONTRACT_ADDRESS` and fails at startup if the address, API URL, or Sepolia RPC URL is absent.

## Interface

```solidity
struct details {
    address sender;
    uint256 timestamp;
    int256 longitudes; // fixed-point degrees * 1e6
    int256 latitudes;  // fixed-point degrees * 1e6
    string ipfsCID;
    bool exists;
}

mapping(bytes32 => details) public photohash;
mapping(address => uint256) public rewardpts;

function submitPlot(bytes32 photoHash, int256 lats, int256 longs, string calldata ipfsCID) external;

function getPlot(bytes32 photoHash) external view returns (
    address submitter,
    int256 lats,
    int256 longs,
    string memory ipfsCID,
    uint256 timestamp,
    bool exists
);

event PlotVerified(
    bytes32 indexed photoHash,
    address indexed submitter,
    int256 latitudes,
    int256 longitudes,
    string ipfsCID,
    uint256 timestamp
);
```

`photoHash` is `keccak256` of the raw middle-frame bytes. Latitude and longitude are pre-scaled by `1e6` in the frontend. A duplicate hash reverts, and each successful submission increments `rewardpts` for the submitting wallet by one.

## Required contract checks

Foundry tests cover storage, rewards, and duplicate prevention. Before production promotion, also validate the deployed address against the exact source/ABI and record a successful UI transaction plus its IPFS CID in `docs/E2E_RUN.md`.
