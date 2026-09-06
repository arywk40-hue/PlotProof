export function isTransientRpcError(error) {
  if (["ACTION_REJECTED", "CALL_EXCEPTION", "TRANSACTION_REPLACED"].includes(error?.code)) return false;
  return [error, error?.error, error?.info?.error, error?.info?.response, error?.response, error?.cause]
    .some((item) => item && (
      ["TIMEOUT", "ETIMEDOUT", -32005, 429].includes(item.code) ||
      [429, 408, 504].includes(item.status ?? item.statusCode) ||
      /rate.?limit|too many requests|timed?\s*out|timeout/i.test(item.message || "")
    ));
}

// Only used to wait on an already broadcast transaction: two attempts total.
export async function retryRpc(read, { onStatus = () => {}, retries = 1,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (attempt >= retries || !isTransientRpcError(error)) throw error;
      const delay = 1000 * 2 ** attempt;
      onStatus(`Network busy. Retrying in ${delay / 1000}s… (${attempt + 1}/${retries})`);
      await sleep(delay);
    }
  }
}

export async function waitForConfirmation(tx, onStatus = () => {}) {
  try {
    const receipt = await retryRpc(() => {
      onStatus("Confirming transaction…");
      return tx.wait(1, 180000);
    }, { onStatus });
    if (!receipt) throw new Error("Confirmation unavailable");
    return receipt;
  } catch (error) {
    if (error.code === "TRANSACTION_REPLACED" && !error.cancelled && error.receipt?.status === 1) {
      return error.receipt;
    }
    const pending = new Error(`Could not confirm transaction ${tx.hash}. Check it in your wallet or explorer before submitting again.`);
    pending.transactionHash = tx.hash;
    throw pending;
  }
}
