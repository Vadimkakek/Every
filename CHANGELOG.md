# Changelog

## 0.2.0

### Added

- block-height consistency checks for batch RPC comparisons
- stale endpoint detection with configurable `--max-block-lag`
- chain ID mismatch detection across compared endpoints
- consistency metadata in JSON output
- health ranking that pushes stale, mismatched, and degraded endpoints below healthy ones

## 0.1.0

Initial public release of Every.

### Added

- single EVM JSON-RPC endpoint health checks
- chain ID, client version, and latest block detection
- repeated latency and success-rate sampling
- comparison and ranking of multiple RPC endpoints
- human-readable and JSON output
- redacted endpoint labels for safer handling of provider URLs
- automated tests and GitHub Actions CI
