# Every — EVM RPC Verifier

Every is a small, dependency-free CLI for checking and comparing the health of
EVM-compatible JSON-RPC endpoints.

It answers a few practical questions quickly:

- Is an endpoint responding?
- Which chain is it connected to?
- Which client implementation is behind it?
- What block height does it report?
- How reliable is it over repeated requests?
- What latency does it have right now?
- Which endpoint in a group looks healthiest?
- Can the result be consumed as JSON in CI or scripts?

## Requirements

- Node.js 20 or newer

## Run locally

```bash
git clone https://github.com/Vadimkakek/Every.git
cd Every
node src/cli.js https://your-rpc.example
```

You can also expose the local CLI through npm:

```bash
npm link
every https://your-rpc.example
```

## Usage

```text
every <rpc-url> [options]
every <rpc-url> <rpc-url> [...] [options]

Options:
  --samples <n>    Number of health samples (1-20, default: 3)
  --timeout <ms>   Per-request timeout (100-60000, default: 5000)
  --json           Print machine-readable JSON
  -h, --help       Show help
```

Check one endpoint:

```bash
every https://your-rpc.example --samples 5
```

Compare several endpoints:

```bash
every https://rpc-one.example https://rpc-two.example https://rpc-three.example
```

Every ranks batch results by success rate first and average latency second.

Machine-readable output works for both single and batch checks:

```bash
every https://rpc-one.example https://rpc-two.example --json
```

## What is checked

Every uses standard JSON-RPC methods commonly available on EVM-compatible
nodes:

- `eth_chainId`
- `web3_clientVersion`
- `eth_blockNumber`

For health sampling, `eth_blockNumber` is repeated a configurable number of
times and Every reports success rate plus min, max, and average latency.

## Privacy and endpoint labels

RPC URLs often contain provider API keys in their path or query string. Batch
results intentionally do not echo the full URL. They display only the protocol
and host, for example `https://rpc.example`.

This keeps a URL such as
`https://rpc.example/v3/your-secret-token` from being reproduced in normal or
JSON output.

## Exit codes

- `0` — all checked endpoints are healthy
- `1` — invalid input or the check could not be started
- `2` — at least one checked endpoint is degraded or failed

## Development

Run the test suite:

```bash
npm test
```

The project intentionally has zero runtime dependencies. CI runs the test suite
against Node.js 20 and 22.

## Security

RPC URLs can contain API keys. Every does not intentionally print full endpoint
URLs back to stdout, and local `.env` files are ignored by git. Never commit
private RPC URLs, wallet keys, seed phrases, or credentials to the repository.

See [SECURITY.md](./SECURITY.md) for the repository security policy.

## Roadmap

- chain name resolution
- response consistency checks
- percentile latency metrics
- configurable output for CI thresholds
- packaged releases

## License

MIT
