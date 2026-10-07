#!/usr/bin/env node

import { checkEndpoint } from "./check.js";

const HELP = `
Every — EVM RPC Verifier

Usage:
  every <rpc-url> [options]
  node src/cli.js <rpc-url> [options]

Options:
  --samples <n>    Number of health samples (1-20, default: 3)
  --timeout <ms>   Per-request timeout (100-60000, default: 5000)
  --json           Print machine-readable JSON
  -h, --help       Show this help
`.trim();

function parseInteger(value, flag) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${flag} expects an integer`);
  }

  return parsed;
}

export function parseArgs(argv) {
  const options = {
    endpoint: null,
    samples: 3,
    timeoutMs: 5000,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--samples") {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error("--samples requires a value");
      }
      options.samples = parseInteger(value, "--samples");
      index += 1;
      continue;
    }

    if (arg === "--timeout") {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error("--timeout requires a value");
      }
      options.timeoutMs = parseInteger(value, "--timeout");
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (options.endpoint) {
      throw new Error("Only one RPC endpoint can be checked at a time");
    }

    options.endpoint = arg;
  }

  return options;
}

function formatLatency(value) {
  return value === null ? "n/a" : `${value.toFixed(2)} ms`;
}

export function formatHuman(result) {
  const { network, health } = result;

  return [
    "Every RPC check",
    `Chain ID:      ${network.chainId} (${network.chainIdHex})`,
    `Client:        ${network.clientVersion}`,
    `Latest block:  ${network.blockNumber}`,
    `Health:        ${health.successes}/${health.samples} (${health.successRate.toFixed(2)}%)`,
    `Latency avg:   ${formatLatency(health.averageLatencyMs)}`,
    `Latency range: ${formatLatency(health.minLatencyMs)} - ${formatLatency(health.maxLatencyMs)}`,
  ].join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  if (options.help) {
    console.log(HELP);
    return 0;
  }

  if (!options.endpoint) {
    console.error(HELP);
    return 1;
  }

  try {
    const result = await checkEndpoint(options.endpoint, {
      samples: options.samples,
      timeoutMs: options.timeoutMs,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatHuman(result));
    }

    return result.health.ok ? 0 : 2;
  } catch (error) {
    console.error(`Every failed: ${error.message}`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}
