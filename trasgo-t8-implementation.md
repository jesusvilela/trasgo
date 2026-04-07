# Trasgo T8 Implementation Roadmap

## Overview
This roadmap outlines the engineering steps to align the Trasgo CLI, runtime, and harness with the T8-verified state.

## Phase A: Parser & Evaluator Fixes (DONE)
- Replace broken `!includes('error')` string matching in `run-v1-v5.mjs`.
- Implement §1 packet parser using `parsePacketStream`.
- Update evaluators to check the `Δ` (delta) axis for reduction results.
- Add `μ.cert` column to the `verify --report` output.

## Phase B: Turing Completeness CLI Support (DONE)
- Add `trasgo verify --tc` command to run the recursive factorial (FACT THREE) probe.
- Implement specialized evaluator for Church numeral results.
- Record `μ.cert` trajectory and `§P|CHECKPOINT` events in `results.json`.

## Phase C: FM3 Threshold & Seeding (DONE)
- Seed FM3 depth collapse threshold from T8 empirical measurement (~depth 2).
- Update `harness/err-watcher.mjs` to flag FM3-imminent when depth/step thresholds are approached.
- Wire `§P|CHECKPOINT` autonomous issuance into the `runCorrectionLoop`.

## Phase D: Web CLI & Playground Upgrade (DONE)
- Update the system prompt in the browser playground (`docs/index.html`) to use the real `src/boot.md` seed.
- Ensure the sandbox can parse and display §1 packets correctly.
- Add "T8 Verified" badge to the landing page.

## Phase E: Release v0.2.0-verified (IN PROGRESS)
- Update `package.json` and `Cargo.toml` to `0.2.0`.
- Generate a proper `CHANGELOG.md` naming the verified findings (T1-T8).
- Tag the repository state.
- Update GitHub Pages with the latest results.

## Phase F: Documentation & Adoption
- Finalize `README.md` with the V2 cert trajectory and T8 TC result.
- Lean into the "Protocol as ISA" framing.
- Add a "Getting Started" guide that doesn't contradict the "paste-ready" nature.

---

### Agent Invocation Template (for Phase B+C)

```text
Read these files:
1. scripts/trasgo-launch.cjs
2. src/trasgo/cli.mjs
3. tests/formal-reasoning/run-v1-v5.mjs
4. src/harness/loop-executor.mjs

Tasks:
1. Add 'tc' to the verify command in cli.mjs.
2. Implement runFormalTest('tc', ...) in run-v1-v5.mjs with Church numeral validation.
3. Wire FM3 threshold detection (depth 2) into the harness and ensure it can trigger checkpoints.
4. Run trasgo verify --all and verify the new TC test passes.
5. Commit: feat(verify): implement T8 Turing Completeness probe and FM3 thresholds
```
