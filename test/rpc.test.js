import test from "node:test";
import assert from "node:assert/strict";

import { RpcError, rpcCall, validateEndpoint } from "../src/rpc.js";

test("validateEndpoint accepts http and https URLs", () => {
  assert.equal(validateEndpoint("https://rpc.example"), "https://rpc.example/");
  assert.equal(validateEndpoint("http://127.0.0.1:8545"), "http://127.0.0.1:8545/");
});

test("validateEndpoint rejects unsupported protocols", () => {
  assert.throws(
    () => validateEndpoint("ws://rpc.example"),
    /must use http or https/,
  );
});

test("rpcCall sends JSON-RPC and returns result with latency", async () => {
  let request;

  const fetchImpl = async (url, options) => {
    request = { url, options };

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          jsonrpc: "2.0",
          id: 1,
          result: "0x1",
        };
      },
    };
  };

  const response = await rpcCall(
    "https://rpc.example",
    "eth_chainId",
    [],
    { fetchImpl },
  );

  assert.equal(request.url, "https://rpc.example/");
  assert.equal(request.options.method, "POST");
  assert.equal(JSON.parse(request.options.body).method, "eth_chainId");
  assert.equal(response.result, "0x1");
  assert.equal(typeof response.latencyMs, "number");
});

test("rpcCall surfaces JSON-RPC errors", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: -32601,
          message: "Method not found",
        },
      };
    },
  });

  await assert.rejects(
    rpcCall("https://rpc.example", "missing_method", [], { fetchImpl }),
    (error) =>
      error instanceof RpcError &&
      error.message === "RPC error: Method not found",
  );
});
