const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Throws during startup instead of accidentally targeting localhost or the zero address. */
export function readRuntimeConfig(env = import.meta.env || {}) {
  const backendUrl = env.VITE_BACKEND_URL?.trim();
  const contractAddress = env.VITE_CONTRACT_ADDRESS?.trim();
  const rpcUrl = env.VITE_SEPOLIA_RPC_URL?.trim();
  const missing = [
    !backendUrl && "VITE_BACKEND_URL",
    !contractAddress && "VITE_CONTRACT_ADDRESS",
    !rpcUrl && "VITE_SEPOLIA_RPC_URL",
  ].filter(Boolean);

  if (missing.length) throw new Error(`PlotProof configuration is missing: ${missing.join(", ")}. Set them in frontend/.env.`);
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress) || contractAddress.toLowerCase() === ZERO_ADDRESS) {
    throw new Error("VITE_CONTRACT_ADDRESS must be a non-zero Ethereum address.");
  }
  try {
    new URL(backendUrl);
    new URL(rpcUrl);
  } catch {
    throw new Error("VITE_BACKEND_URL and VITE_SEPOLIA_RPC_URL must be valid URLs.");
  }
  return { backendUrl, contractAddress, rpcUrl };
}

let runtimeConfig;
export let CONFIG_ERROR = null;
try {
  runtimeConfig = readRuntimeConfig();
} catch (error) {
  CONFIG_ERROR = error.message;
  console.error(`PlotProof startup blocked: ${CONFIG_ERROR}`);
}

export const BACKEND_URL = runtimeConfig?.backendUrl;
export const CONTRACT_ADDRESS = runtimeConfig?.contractAddress;

export const CONTRACT_ABI = [
  "function submitPlot(bytes32 photoHash, int256 lat, int256 lon, string ipfsCID) external",
  "function getPlot(bytes32 photoHash) external view returns (address submitter, int256 lat, int256 lon, string ipfsCID, uint256 timestamp, bool exists)",
  "function rewardpts(address farmer) external view returns (uint256)",
  "event PlotVerified(bytes32 indexed photoHash, address indexed submitter, int256 lat, int256 lon, string ipfsCID, uint256 timestamp)",
];

export const SEPOLIA_CHAIN = {
  chainId: "0xaa36a7",
  chainName: "Sepolia Test Network",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: runtimeConfig ? [runtimeConfig.rpcUrl] : [],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};
