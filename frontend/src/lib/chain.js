import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, SEPOLIA_CHAIN } from "./config.js";
import { retryRpc, waitForConfirmation } from "./rpcRetry.js";

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("No wallet found. Install MetaMask (or use a demo wallet) to submit on-chain.");
  }

  await window.ethereum.request({ method: "eth_requestAccounts" });

  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN.chainId }] });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [SEPOLIA_CHAIN] });
    } else {
      throw switchError;
    }
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return { provider, signer, address: await signer.getAddress() };
}

export function getReadOnlyContract() {
  const request = new ethers.FetchRequest(SEPOLIA_CHAIN.rpcUrls[0]);
  request.timeout = 20000;
  const provider = new ethers.JsonRpcProvider(request);
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

export async function submitPlotOnChain(signer, photoHash, lat, lon,ipfsCID, onStatus) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  // Contract expects fixed-point ints (see INTERFACE_SPEC.md) — scale by 1e6
  // to preserve ~0.11m precision while staying integer-only on-chain.
  const latFixed = Math.round(lat * 1e6);
  const lonFixed = Math.round(lon * 1e6);
  const tx = await contract.submitPlot(photoHash, latFixed, lonFixed,ipfsCID);
  const receipt = await waitForConfirmation(tx, onStatus);
  return receipt;
}

export async function fetchPlot(photoHash, onStatus) {
  const contract = getReadOnlyContract();
  let result;
  try {
    result = await retryRpc(() => contract.getPlot(photoHash), { onStatus });
  } finally {
    contract.runner.destroy();
  }

  return {
    submitter: result[0],
    lat: Number(result[1]) / 1e6,
    lon: Number(result[2]) / 1e6,
    ipfsCID: result[3],
    timestamp: Number(result[4]),
    exists: result[5],
  };
}

/**
 * keccak256 of raw image bytes, computed client-side — this is the hash
 * that gets anchored on-chain. Must match exactly what the contract
 * expects (raw bytes32 of keccak256, no ABI-encoding wrapper).
 */
export async function keccak256OfImage(blob) {
  const buffer = await blob.arrayBuffer();
  return ethers.keccak256(new Uint8Array(buffer));
}
