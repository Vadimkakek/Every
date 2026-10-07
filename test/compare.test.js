import test from "node:test";
import assert from "node:assert/strict";

import { compareEndpoints } from "../src/compare.js";

function createComparisonMock() {
  const blockCalls = new Map();

  return async (url, options) => {
    const request = JSON.parse(options.body);
    const hostname = new URL(url).hostname;

    if (request.method === "eth_blockNumber") {
      const count = (blockCalls.get(hostname) || 0) + 1;
      blockCalls.set(hostname, count);

      if (hostname === "slow.example" && count === 4) {
        throw new Error("temporary upstream failure");
      }
    }

    const results = {
      eth_chainId: "0x1",
      web3_clientVersion: "Every/TestClient/v1.0.0",
      eth_blockNumber: "0x10",
    };

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: results[request.method],
        };
      },
    };
  };
}

test("compareEndpoints ranks healthier endpoints first", async () => {
  const result = await compareEndpoints(
    [
      "https://slow.example/private-token",
      "https://fast.example/v3/another-private-token",
    ],
    {
      samples: 3,
      fetchImpl: createComparisonMock(),
    },
  );

  assert.equal(result.endpoints, 2);
  assert.equal(result.results[0].endpoint, "https://fast.example");
  assert.equal(result.results[0].health.successRate, 100);
  assert.equal(result.results[1].endpoint, "https://slow.example");
  assert.equal(result.results[1].health.successRate, 66.67);
});

test("compareEndpoints never exposes endpoint paths or query credentials", async () => {
  const result = await compareEndpoints(
    [
      "https://one.example/v3/not-a-real-key",
      "https://two.example/rpc?apikey=not-a-real-key",
    ],
    {
      samples: 1,
      fetchImpl: createComparisonMock(),
    },
  );

  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes("not-a-real-key"), false);
  assert.equal(serialized.includes("/v3/"), false);
  assert.equal(serialized.includes("apikey="), false);
});

test("compareEndpoints requires at least two endpoints", async () => {
  await assert.rejects(
    compareEndpoints(["https://rpc.example"]),
    /requires at least two RPC endpoints/,
  );
});
