
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

export const CONTRACT_ABI = [
  "function submitPlot(bytes32 photoHash, int256 lat, int256 lon, string ipfsCID) external",

  "function getPlot(bytes32 photoHash) external view returns (address submitter, int256 lat, int256 lon, string ipfsCID, uint256 timestamp, bool exists)",

  "function rewardpts(address farmer) external view returns (uint256)",

  "event PlotVerified(bytes32 indexed photoHash, address indexed submitter, int256 lat, int256 lon, string ipfsCID, uint256 timestamp)",
];

export const SEPOLIA_CHAIN = {
  chainId: "0xaa36a7", // 11155111
  chainName: "Sepolia Test Network",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: ["https://rpc.sepolia.org"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};
