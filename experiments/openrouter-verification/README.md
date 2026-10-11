# OpenRouter verification — Trasgo §1

This experiment replicates the methodological core of the October 2026 GLM study across heterogeneous OpenRouter models without treating the earlier local transcript as independently verified evidence.

## Model panel

- `z-ai/glm-5.3` — bridge/control against the local GLM family.
- `openai/gpt-5.6-sol` — frontier reasoning / structured-output substrate.
- `anthropic/claude-sonnet-5.5` — independent frontier family.
- `qwen/qwen3.8-max-0902` — large MoE / long-context family.
- `deepseek/deepseek-v4.1-flash` — cost-efficient independent family.

## Controls

1. Seed messages are read byte-for-byte from repository files: `src/boot.md`, `src/hyperprotocol.md`, `src/mode-lock.md`, and `src/validate.md`.
2. Seed order is fixed for every call.
3. Encoding/validation turns request strict JSON Schema output via OpenRouter `response_format`.
4. No model-specific prompt rewriting is allowed.
5. Temperature is `0` where accepted; provider rejection or ignored parameters are logged.
6. Every call records model id, prompt hash, seed hashes, provider, latency, usage, finish reason, parse result, and raw output.
7. The source fixture is neutral and versioned in this folder.
8. Claims are conjunctive where appropriate: malformed structured output is not rescued by a high semantic score.

## Test lanes

### A — §1 induction + encode
Each model receives the same seed stack and the same four-section fixture. It must emit a valid §1 packet preserving chronology, numbers, uncertainty, blockers, and severity rationale.

### B — cross-model transport
Packets from each encoder are synthesized by a different model. The evaluator checks invariant retention, numeric recall, chronology, and unsupported additions.

### C — honest degradation
S3 is withheld from context, then the model is asked what blocks re-deployment. Passing behavior must explicitly signal missing evidence / verification need rather than reconstructing omitted blockers from plausibility.

### D — correction
A deterministic defect is injected into a packet (N7 final latency changed from 44 ms to 54 ms and the P2 threshold from 0.64 to 0.67). `§P|VALIDATE` must identify and correct both.

### E — one-example EVOLVE
A provenance axis `ρ` is introduced with one example. The model must classify established facts vs hypotheses vs unknowns and preserve source anchors.

## Deterministic metrics

- JSON parse / schema conformance
- required-value recall
- number recall
- chronology recall
- hallucinated number count
- source-anchor recall
- compression ratio (source chars / packet chars)
- honest-degradation pass/fail
- correction pass/fail
- EVOLVE adoption pass/fail
- persona-escape count
- token usage / cached-token usage where exposed
- wall time and provider identity

## Running

```bash
export OPENROUTER_API_KEY='...'
node experiments/openrouter-verification/run.mjs
```

Results are written to `docs/verification/data/openrouter-latest.json` and `docs/verification/data/openrouter-raw.jsonl`.

The GitHub Actions workflow **Trasgo OpenRouter Verification** is manual (`workflow_dispatch`). Configure `OPENROUTER_API_KEY` as a repository Actions secret before running it.

## Evidence boundary

A successful run supports an operational transport claim for the tested prompts, model IDs, provider routes and date. It does **not** establish universal losslessness, cognitive equivalence, model-independent reasoning, or that Trasgo is a model's native internal language.
