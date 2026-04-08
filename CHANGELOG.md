# Changelog

## [0.2.10] - 2026-04-08
### Changed
- **Lighter Package**: Removed the 3.2MB `trasgo.png` image to drastically reduce install size and speed up downloads. The CLI now relies on its native ASCII banner rendering across all environments.
- **Benchmarks**: Added `openai` provider natively to `bench_online.py` so that `bench openai` works out of the box with GPT models.

## [0.2.9] - 2026-04-08
### Fixed
- **Publish CI Flap**: Fixed an intermittent CI issue where running a single test (`verify --tc`) inadvertently overwrote the entire `results.json` suite file, causing subsequent smoke tests (like those in `prepublishOnly`) to fail. The smoke test now restores the full verification state after the isolated probe.

## [0.2.8] - 2026-04-08
### Fixed
- **Publish scripts**: Fixed `release:check` and `test` scripts that failed during `npm publish` due to path refactoring in previous versions. `trasgo-launch.cjs`, `ci-smoke.mjs`, and `results.json` paths have been updated to properly locate the moved scripts within `src/`.

## [0.2.7] - 2026-04-07
### Fixed
- **Dashboard Loader Resolution**: Restored `dashboard.mjs` to the package root while keeping the implementation in `src/trasgo/`. This root proxy ensures that the Node.js loader can always find the module in global installations on Windows, resolving the persistent `MODULE_NOT_FOUND` error.

## [0.2.6] - 2026-04-07
### Fixed
- **Dashboard Final Resolution**: Refactored the dashboard logic to reside at the root `dashboard.mjs` while being imported directly into `cli.mjs`. This provides the strongest possible resolution for both standalone execution and built-in CLI command paths across all platforms.
- **Robust Rendering**: Added defensive array checks to the dashboard to prevent crashes when partial benchmark data is encountered.

## [0.2.5] - 2026-04-07
### Fixed
- **Dashboard Command Persistence**: Completely resolved the `MODULE_NOT_FOUND` error for the `dashboard` command by removing legacy tool and machine definitions from `registry.json` that were still attempting to resolve `dashboard.mjs` as an external file. The dashboard is now a purely internal built-in command.

## [0.2.4] - 2026-04-07
### Changed
- **Built-in Dashboard**: Refactored the `dashboard` and `live-dashboard` tools into built-in CLI commands. They are now directly imported and executed within the main `trasgo` process, eliminating all `MODULE_NOT_FOUND` and process-spawning issues in global NPM installations.

## [0.2.3] - 2026-04-07
### Fixed
- **Logo Visibility**: Added `symbols` as a fallback image backend for `chafa`, ensuring the Trasgo logo is visible in standard terminals (Mac Terminal.app, generic zsh/bash) even without advanced image protocol support.
- **Package Assets**: Explicitly included `trasgo.png` in the NPM package root to ensure the CLI can find it for rendering.
- **Dashboard Resolution**: Refined the `dashboard.mjs` root proxy to improve module resolution across different Node.js environments.

## [0.2.2] - 2026-04-07
### Fixed
- **Dashboard Availability**: Implemented a root proxy script `dashboard.mjs` that redirects to the core implementation in `src/trasgo/`. This ensures the `dashboard` command works reliably in global NPM installations regardless of how Node.js resolves modules.

## [0.2.1] - 2026-04-07
### Fixed
- **Dashboard Packaging**: Fixed `MODULE_NOT_FOUND` error when running `dashboard` from a global install by moving `dashboard.mjs` to `src/trasgo/` and correcting its internal relative paths.
- **Smoke Tests**: Added explicit verification for the `dashboard` command in `packaged-smoke.mjs`.

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
