import { checkEndpoint } from "./check.js";

function safeEndpointLabel(endpoint) {
  try {
    const url = new URL(endpoint);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "invalid-endpoint";
  }
}

function latencyForSort(result) {
  const value = result.health?.averageLatencyMs;
  return typeof value === "number" ? value : Number.POSITIVE_INFINITY;
}

function lagForSort(result) {
  const value = result.consistency?.blockLag;
  return typeof value === "number" ? value : Number.POSITIVE_INFINITY;
}

function validateMaxBlockLag(maxBlockLag) {
  if (!Number.isInteger(maxBlockLag) || maxBlockLag < 0 || maxBlockLag > 1000000) {
    throw new Error("max block lag must be an integer between 0 and 1000000");
  }
}

function addConsistency(results, maxBlockLag) {
  const withNetwork = results.filter((result) => result.network !== null);
  const chainIds = [...new Set(withNetwork.map((result) => result.network.chainId))];
  const sameChain = chainIds.length <= 1;

  let highestBlock = null;
  if (sameChain && withNetwork.length > 0) {
    highestBlock = withNetwork.reduce((highest, result) => {
      const block = BigInt(result.network.blockNumber);
      return block > highest ? block : highest;
    }, 0n);
  }

  const enriched = results.map((result) => {
    if (!result.network) {
      return {
        ...result,
        consistency: {
          chainMismatch: false,
          stale: false,
          blockLag: null,
        },
      };
    }

    const chainMismatch = !sameChain;
    const blockLag = highestBlock === null
      ? null
      : Number(highestBlock - BigInt(result.network.blockNumber));
    const stale = !chainMismatch && blockLag !== null && blockLag > maxBlockLag;

    return {
      ...result,
      ok: result.health.ok && !chainMismatch && !stale,
      consistency: {
        chainMismatch,
        stale,
        blockLag,
      },
    };
  });

  return {
    results: enriched,
    consistency: {
      sameChain,
      chainIds,
      highestBlock: highestBlock === null ? null : highestBlock.toString(),
      maxBlockLag,
    },
  };
}

export async function compareEndpoints(
  endpoints,
  {
    samples = 3,
    timeoutMs = 5000,
    maxBlockLag = 3,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (!Array.isArray(endpoints) || endpoints.length < 2) {
    throw new Error("batch comparison requires at least two RPC endpoints");
  }

  validateMaxBlockLag(maxBlockLag);

  const checked = await Promise.all(
    endpoints.map(async (endpoint) => {
      const label = safeEndpointLabel(endpoint);

      try {
        const result = await checkEndpoint(endpoint, {
          samples,
          timeoutMs,
          fetchImpl,
        });

        return {
          endpoint: label,
          ok: result.health.ok,
          network: result.network,
          health: result.health,
          checkedAt: result.checkedAt,
          error: null,
        };
      } catch (error) {
        return {
          endpoint: label,
          ok: false,
          network: null,
          health: {
            ok: false,
            samples,
            successes: 0,
            successRate: 0,
            averageLatencyMs: null,
            minLatencyMs: null,
            maxLatencyMs: null,
            latencySamplesMs: [],
          },
          checkedAt: new Date().toISOString(),
          error: error?.message || "RPC check failed",
        };
      }
    }),
  );

  const { results, consistency } = addConsistency(checked, maxBlockLag);

  results.sort((left, right) => {
    if (left.ok !== right.ok) {
      return left.ok ? -1 : 1;
    }

    const rateDifference =
      (right.health?.successRate ?? 0) - (left.health?.successRate ?? 0);

    if (rateDifference !== 0) {
      return rateDifference;
    }

    const lagDifference = lagForSort(left) - lagForSort(right);
    if (lagDifference !== 0) {
      return lagDifference;
    }

    return latencyForSort(left) - latencyForSort(right);
  });

  return {
    endpoints: results.length,
    healthy: results.filter((result) => result.ok).length,
    consistency,
    results: results.map((result, index) => ({
      rank: index + 1,
      ...result,
    })),
    checkedAt: new Date().toISOString(),
  };
}
