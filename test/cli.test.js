import test from "node:test";
import assert from "node:assert/strict";

import { formatBatchHuman, parseArgs } from "../src/cli.js";

test("parseArgs accepts multiple endpoints", () => {
  const options = parseArgs([
    "https://one.example",
    "https://two.example",
    "--samples",
    "5",
    "--json",
  ]);

  assert.deepEqual(options.endpoints, [
    "https://one.example",
    "https://two.example",
  ]);
  assert.equal(options.samples, 5);
  assert.equal(options.json, true);
});

test("formatBatchHuman prints ranking without private URL paths", () => {
  const output = formatBatchHuman({
    endpoints: 2,
    healthy: 2,
    results: [
      {
        rank: 1,
        endpoint: "https://one.example",
        error: null,
        network: { chainId: "1" },
        health: { successRate: 100, averageLatencyMs: 12.5 },
      },
      {
        rank: 2,
        endpoint: "https://two.example",
        error: null,
        network: { chainId: "1" },
        health: { successRate: 100, averageLatencyMs: 25 },
      },
    ],
  });

  assert.match(output, /#1 https:\/\/one\.example/);
  assert.match(output, /#2 https:\/\/two\.example/);
});
