# Every — EVM RPC Verifier

Every is a small, dependency-free CLI for checking the health and identity of
EVM-compatible JSON-RPC endpoints.

It answers a few practical questions quickly:

- Is the endpoint responding?
- Which chain is it connected to?
- Which client implementation is behind it?
- What block height does it report?
- How reliable is it over repeated requests?
- What latency does it have right now?
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

Options:
  --samples <n>    Number of health samples (1-20, default: 3)
  --timeout <ms>   Per-request timeout (100-60000, default: 5000)
  --json           Print machine-readable JSON
  -h, --help       Show help
```

Example:

```bash
every https://your-rpc.example --samples 5
```

Machine-readable output:

```bash
every https://your-rpc.example --json
```

## What is checked

Every uses standard JSON-RPC methods commonly available on EVM-compatible
nodes:

- `eth_chainId`
- `web3_clientVersion`
- `eth_blockNumber`

For health sampling, `eth_blockNumber` is repeated a configurable number of
times and Every reports success rate plus min, max, and average latency.

## Exit codes

- `0` — all health samples succeeded
- `1` — invalid input or the RPC check could not be completed
- `2` — the endpoint responded, but one or more health samples failed

## Development

Run the test suite:

```bash
npm test
```

The project intentionally has zero runtime dependencies. CI runs the test suite
against Node.js 20 and 22.

## Security

RPC URLs can contain API keys. Every does not intentionally print the endpoint
back to stdout, and local `.env` files are ignored by git. Never commit private
RPC URLs, wallet keys, seed phrases, or credentials to the repository.

## Roadmap

- optional batch mode for multiple endpoints
- chain name resolution
- response consistency checks
- percentile latency metrics
- configurable output for CI thresholds
- packaged releases

## License

MIT
