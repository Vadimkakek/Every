import { rpcCall } from "./rpc.js";

function parseHexQuantity(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    throw new Error(`${label} returned an invalid hex quantity`);
  }

  return BigInt(value);
}

function round(value) {
  return Number(value.toFixed(2));
}

export async function checkEndpoint(
  endpoint,
  {
    samples = 3,
    timeoutMs = 5000,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (!Number.isInteger(samples) || samples < 1 || samples > 20) {
    throw new Error("samples must be an integer between 1 and 20");
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) {
    throw new Error("timeout must be an integer between 100 and 60000 milliseconds");
  }

  const requestOptions = { timeoutMs, fetchImpl };

  const [chain, client, block] = await Promise.all([
    rpcCall(endpoint, "eth_chainId", [], requestOptions),
    rpcCall(endpoint, "web3_clientVersion", [], requestOptions),
    rpcCall(endpoint, "eth_blockNumber", [], requestOptions),
  ]);

  const chainId = parseHexQuantity(chain.result, "eth_chainId");
  const blockNumber = parseHexQuantity(block.result, "eth_blockNumber");

  const latencySamples = [];
  let successes = 0;

  for (let index = 0; index < samples; index += 1) {
    try {
      const sample = await rpcCall(endpoint, "eth_blockNumber", [], requestOptions);
      successes += 1;
      latencySamples.push(sample.latencyMs);
    } catch {
      latencySamples.push(null);
    }
  }

  const successfulLatencies = latencySamples.filter((value) => value !== null);
  const averageLatencyMs = successfulLatencies.length
    ? round(
        successfulLatencies.reduce((total, value) => total + value, 0) /
          successfulLatencies.length,
      )
    : null;

  return {
    network: {
      chainId: chainId.toString(),
      chainIdHex: chain.result,
      clientVersion: String(client.result),
      blockNumber: blockNumber.toString(),
      blockNumberHex: block.result,
    },
    health: {
      ok: successes === samples,
      samples,
      successes,
      successRate: round((successes / samples) * 100),
      averageLatencyMs,
      minLatencyMs: successfulLatencies.length
        ? Math.min(...successfulLatencies)
        : null,
      maxLatencyMs: successfulLatencies.length
        ? Math.max(...successfulLatencies)
        : null,
      latencySamplesMs: latencySamples,
    },
    checkedAt: new Date().toISOString(),
  };
}
