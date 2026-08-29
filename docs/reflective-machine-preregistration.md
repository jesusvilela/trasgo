# Reflective-machine experiment: preregistration and evaluation protocol

## Research question

Can a frozen generative substrate instantiate the six-property Trasgo Reflective Machine when semantics are taught and modified only through bounded in-context examples?

The machine-readable design is frozen in [`src/tests/reflective-machine-preregistration.json`](../src/tests/reflective-machine-preregistration.json). Its current status is **design preregistered, empirical run not yet performed**. Do not present deterministic scaffold results as model results.

## Decisive experiment

Use a synthetic semantic rule family absent from all boot prompts. Each generated family has opaque axis and operator names to reduce prior familiarity. A trial proceeds as follows:

1. Freeze the boot examples, held-out cases, scoring code, model/version identifiers, decoding settings, and file hashes in a run manifest.
2. Boot backend A with examples defining rule \(q_0\). Evaluate disjoint held-out programs.
3. Checkpoint state and semantics before mutation.
4. Inject a malformed transition and require detection plus checkpoint recovery.
5. Supply one EVOLVE example that changes rule \(q_0\) to \(q_1\). Run paired, unseen cases that distinguish the rules.
6. Serialize the checkpoint after evolution, start a fresh context on backend B, and restore only the declared portable bundle.
7. Continue a withheld program on B. Round-trip the final §1 state through natural language and back to §1.
8. Score outputs with blinded deterministic validators. Preserve raw requests and responses append-only.

Training examples, mutation examples, and held-out cases must be procedurally disjoint. The mutation rule must not be inferable by copying an answer from its worked example.

## Conditions and controls

Run at least 30 trials for every backend × condition cell:

| Condition | Purpose |
|---|---|
| Full machine | §K proposal, validation, EVOLVE, checkpoint, and migration |
| No EVOLVE | Tests whether post-mutation behavior is caused by semantic installation |
| No validation | Measures the contribution of verify/commit separation |
| Natural-language only | Compares the structured semantic-state representation |

Randomize trial and condition order. When supported, use provider seeds and record them; a seed does not remove the need for repeated trials. Keep token budgets equal within paired conditions. Report each backend separately before any pooled estimate.

## Endpoints

| Property | Primary endpoint | Pass threshold |
|---|---|---:|
| Inducibility | exact pass rate over held-out pre-mutation programs | 0.80 |
| Operational closure | well-formed committed states / all committed states | 0.99 |
| Reflectivity | paired unseen cases changing from \(q_0\)-correct to \(q_1\)-correct | 0.80 |
| Transport invariance | preregistered invariant paths preserved | 0.95 |
| Recoverability | injected faults detected and correctly recomputed | 0.80 |
| Substrate portability | correct withheld continuations on backend B | 0.80 |

For each proportion report numerator, denominator, point estimate, and Wilson 95% interval. A property conforms only when the point estimate reaches its threshold and its Wilson lower bound exceeds the task's preregistered chance baseline. Report all six endpoints; do not substitute a weighted score.

## Scoring and missing data

- Parse failures, unsupported-axis responses, invariant loss, and silent commits of injected faults count as failures.
- Exclude only a provider outage before generation, provider-confirmed truncation, or a mismatch from the frozen model version. Publish exclusions by condition.
- Score exact symbolic results and state paths programmatically. Human adjudication is limited to a frozen rubric for natural-language equivalence; adjudicators are blind to condition and backend.
- Resolve adjudicator disagreement using the frozen third-adjudicator procedure, never prompt author judgment.
- Correctness and preservation are distinct: a wrong value preserved across migration is invariant but not a correct continuation.

## Required artifacts

Each empirical release must include:

- preregistration and fixture hashes;
- code commit and dirty-tree status;
- backend, model/version, endpoint, decoding parameters, and dates;
- randomization map and trial IDs;
- raw prompts/responses, finish reasons, latency, and token counts;
- checkpoint bundles before and after EVOLVE;
- machine-readable per-trial scores and aggregate report;
- deviations and exclusions.

## Threats to validity

Likely contamination by familiar rule names is controlled with opaque generated semantics. Prompt sensitivity is addressed through repeated families rather than one showcase. Provider drift is bounded by version manifests and run windows. Cross-backend success may still reflect shared pretraining rather than a new machine class; the no-EVOLVE control and paired rule reversal specifically test whether the in-context semantic write caused the behavior.
