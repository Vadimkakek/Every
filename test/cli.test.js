import test from "node:test";
import assert from "node:assert/strict";

import { formatBatchHuman, parseArgs } from "../src/cli.js";

test("parseArgs accepts multiple endpoints and block lag threshold", () => {
  const options = parseArgs([
    "https://one.example",
    "https://two.example",
    "--samples",
    "5",
    "--max-block-lag",
    "4",
    "--json",
  ]);

  assert.deepEqual(options.endpoints, [
    "https://one.example",
    "https://two.example",
  ]);
  assert.equal(options.samples, 5);
  assert.equal(options.maxBlockLag, 4);
  assert.equal(options.json, true);
});

test("formatBatchHuman prints staleness without private URL paths", () => {
  const output = formatBatchHuman({
    endpoints: 2,
    healthy: 1,
    consistency: {
      sameChain: true,
      chainIds: ["1"],
      highestBlock: "100",
      maxBlockLag: 3,
    },
    results: [
      {
        rank: 1,
        endpoint: "https://one.example",
        ok: true,
        error: null,
        network: { chainId: "1", blockNumber: "100" },
        health: { ok: true, successRate: 100, averageLatencyMs: 12.5 },
        consistency: { chainMismatch: false, stale: false, blockLag: 0 },
      },
      {
        rank: 2,
        endpoint: "https://two.example",
        ok: false,
        error: null,
        network: { chainId: "1", blockNumber: "95" },
        health: { ok: true, successRate: 100, averageLatencyMs: 25 },
        consistency: { chainMismatch: false, stale: true, blockLag: 5 },
      },
    ],
  });

  assert.match(output, /#1 https:\/\/one\.example/);
  assert.match(output, /#2 https:\/\/two\.example/);
  assert.match(output, /Status:  stale/);
  assert.match(output, /Block:   95 \(-5\)/);
});
