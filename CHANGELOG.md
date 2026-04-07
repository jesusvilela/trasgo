# Changelog

## [0.2.0] - 2026-04-07
### Added
- **Turing Completeness Probe**: Added `trasgo verify --tc` to execute recursive Factorial 3 computation (T8).
- **Formal Verification V6**: Integrated Church numeral arithmetic and recursive expansion validation.
- **FM3 Threshold Detection**: Harness now seeds depth-collapse triggers at recursive depth 2.
- **Autonomous Checkpointing**: `runCorrectionLoop` can now issue `§P|CHECKPOINT` instructions when thresholds are imminent.
- **T8 Implementation Roadmap**: Formalized the path to full agentic implementation.
- **Verified Preliminary Draft**: Integrated the finalized paper `trasgo-paper-final.md`.

### Fixed
- **Evaluator Axis Bug**: V2/V5 evaluators now check the `Δ` (delta) axis for reduction results (frontiers correctly emit deltas).
- **Verify Parser**: Replaced broken string matching with a proper §1 JSON block parser in `run-v1-v5.mjs`.
- **Packaging**: Included `dashboard.mjs` in the npm package distribution.
- **Unit Tests**: Restored `harness-unit.mjs` and ensured it covers V1-V6 evaluators.

### Changed
- **CLI Reports**: Added `μ.cert` column to `verify --report` output.
- **Web Sandbox**: Updated system prompt with real `boot.md` seed and EX4 error signal examples.
- **Architecture**: Formalized the "Protocol as ISA" and "System Prompt as Program" framing.

## [0.1.1] - 2026-04-06
- Initial public release.
- Added §1 codec implementation.
- Added native Rust orchestrator.
- Added formal reasoning benchmarks V1-V5.
