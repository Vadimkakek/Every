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

export async function compareEndpoints(
  endpoints,
  {
    samples = 3,
    timeoutMs = 5000,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (!Array.isArray(endpoints) || endpoints.length < 2) {
    throw new Error("batch comparison requires at least two RPC endpoints");
  }

  const results = await Promise.all(
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

  results.sort((left, right) => {
    const rateDifference =
      (right.health?.successRate ?? 0) - (left.health?.successRate ?? 0);

    if (rateDifference !== 0) {
      return rateDifference;
    }

    return latencyForSort(left) - latencyForSort(right);
  });

  return {
    endpoints: results.length,
    healthy: results.filter((result) => result.ok).length,
    results: results.map((result, index) => ({
      rank: index + 1,
      ...result,
    })),
    checkedAt: new Date().toISOString(),
  };
}
