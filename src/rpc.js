export class RpcError extends Error {
  constructor(message, { method, status, cause } = {}) {
    super(message, { cause });
    this.name = "RpcError";
    this.method = method;
    this.status = status;
  }
}

export function validateEndpoint(endpoint) {
  let url;

  try {
    url = new URL(endpoint);
  } catch {
    throw new RpcError("RPC endpoint must be a valid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new RpcError("RPC endpoint must use http or https");
  }

  return url.toString();
}

export async function rpcCall(
  endpoint,
  method,
  params = [],
  { timeoutMs = 5000, fetchImpl = globalThis.fetch } = {},
) {
  const normalizedEndpoint = validateEndpoint(endpoint);

  if (typeof fetchImpl !== "function") {
    throw new RpcError("No fetch implementation is available", { method });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetchImpl(normalizedEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
      signal: controller.signal,
    });

    const latencyMs = Number((performance.now() - startedAt).toFixed(2));

    if (!response.ok) {
      throw new RpcError(`RPC returned HTTP ${response.status}`, {
        method,
        status: response.status,
      });
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new RpcError("RPC returned invalid JSON", { method, cause: error });
    }

    if (payload?.error) {
      const message = payload.error.message || "Unknown JSON-RPC error";
      throw new RpcError(`RPC error: ${message}`, { method });
    }

    if (!payload || !Object.hasOwn(payload, "result")) {
      throw new RpcError("RPC response is missing a result field", { method });
    }

    return {
      result: payload.result,
      latencyMs,
    };
  } catch (error) {
    if (error instanceof RpcError) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw new RpcError(`RPC request timed out after ${timeoutMs}ms`, {
        method,
        cause: error,
      });
    }

    throw new RpcError(`RPC request failed: ${error?.message || "unknown error"}`, {
      method,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}
