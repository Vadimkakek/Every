import test from "node:test";
import assert from "node:assert/strict";

import { checkEndpoint } from "../src/check.js";

function createRpcMock() {
  return async (_url, options) => {
    const request = JSON.parse(options.body);

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

test("checkEndpoint returns network identity and health metrics", async () => {
  const result = await checkEndpoint("https://rpc.example", {
    samples: 3,
    fetchImpl: createRpcMock(),
  });

  assert.equal(result.network.chainId, "1");
  assert.equal(result.network.chainIdHex, "0x1");
  assert.equal(result.network.clientVersion, "Every/TestClient/v1.0.0");
  assert.equal(result.network.blockNumber, "16");

  assert.equal(result.health.ok, true);
  assert.equal(result.health.samples, 3);
  assert.equal(result.health.successes, 3);
  assert.equal(result.health.successRate, 100);
  assert.equal(result.health.latencySamplesMs.length, 3);
});

test("checkEndpoint validates sample count", async () => {
  await assert.rejects(
    checkEndpoint("https://rpc.example", {
      samples: 0,
      fetchImpl: createRpcMock(),
    }),
    /samples must be an integer between 1 and 20/,
  );
});
