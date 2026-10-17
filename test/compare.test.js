import test from "node:test";
import assert from "node:assert/strict";

import { compareEndpoints } from "../src/compare.js";

function createComparisonMock(config = {}) {
  const blockCalls = new Map();

  return async (url, options) => {
    const request = JSON.parse(options.body);
    const hostname = new URL(url).hostname;
    const endpoint = config[hostname] ?? {};
    const chainId = endpoint.chainId ?? "0x1";
    const blockNumber = endpoint.blockNumber ?? "0x10";

    if (request.method === "eth_blockNumber") {
      const count = (blockCalls.get(hostname) || 0) + 1;
      blockCalls.set(hostname, count);

      if (endpoint.failBlockCall === count) {
        throw new Error("temporary upstream failure");
      }
    }

    const results = {
      eth_chainId: chainId,
      web3_clientVersion: "Every/TestClient/v1.0.0",
      eth_blockNumber: blockNumber,
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
      fetchImpl: createComparisonMock({
        "slow.example": { failBlockCall: 4 },
      }),
    },
  );

  assert.equal(result.endpoints, 2);
  assert.equal(result.results[0].endpoint, "https://fast.example");
  assert.equal(result.results[0].health.successRate, 100);
  assert.equal(result.results[1].endpoint, "https://slow.example");
  assert.equal(result.results[1].health.successRate, 66.67);
});

test("compareEndpoints marks endpoints stale by block lag", async () => {
  const result = await compareEndpoints(
    ["https://fresh.example", "https://behind.example"],
    {
      samples: 1,
      maxBlockLag: 3,
      fetchImpl: createComparisonMock({
        "fresh.example": { blockNumber: "0x64" },
        "behind.example": { blockNumber: "0x5f" },
      }),
    },
  );

  assert.equal(result.consistency.sameChain, true);
  assert.equal(result.consistency.highestBlock, "100");
  assert.equal(result.healthy, 1);

  const behind = result.results.find(
    (entry) => entry.endpoint === "https://behind.example",
  );

  assert.equal(behind.consistency.blockLag, 5);
  assert.equal(behind.consistency.stale, true);
  assert.equal(behind.ok, false);
});

test("compareEndpoints accepts endpoints within the block lag threshold", async () => {
  const result = await compareEndpoints(
    ["https://fresh.example", "https://near.example"],
    {
      samples: 1,
      maxBlockLag: 3,
      fetchImpl: createComparisonMock({
        "fresh.example": { blockNumber: "0x64" },
        "near.example": { blockNumber: "0x62" },
      }),
    },
  );

  assert.equal(result.healthy, 2);
  assert.equal(
    result.results.find((entry) => entry.endpoint === "https://near.example")
      .consistency.stale,
    false,
  );
});

test("compareEndpoints flags chain ID mismatches", async () => {
  const result = await compareEndpoints(
    ["https://one.example", "https://two.example"],
    {
      samples: 1,
      fetchImpl: createComparisonMock({
        "one.example": { chainId: "0x1", blockNumber: "0x64" },
        "two.example": { chainId: "0xa", blockNumber: "0x64" },
      }),
    },
  );

  assert.equal(result.consistency.sameChain, false);
  assert.deepEqual(result.consistency.chainIds.sort(), ["1", "10"]);
  assert.equal(result.healthy, 0);
  assert.equal(
    result.results.every((entry) => entry.consistency.chainMismatch),
    true,
  );
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

test("compareEndpoints validates max block lag", async () => {
  await assert.rejects(
    compareEndpoints(
      ["https://one.example", "https://two.example"],
      { maxBlockLag: -1 },
    ),
    /max block lag must be an integer between 0 and 1000000/,
  );
});

test("compareEndpoints requires at least two endpoints", async () => {
  await assert.rejects(
    compareEndpoints(["https://rpc.example"]),
    /requires at least two RPC endpoints/,
  );
});
