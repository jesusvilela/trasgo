# Trasgo Reflective Machine implementation roadmap

This roadmap separates host guarantees from empirical claims. A stage is complete only when its exit criteria and artifacts exist; a demo is not a substitute.

## Phase 0 — terminology and frozen contracts (now)

**Deliverables:** formal tuple and transition boundary; §K architecture; six conformance properties; machine-readable preregistration; deterministic reference kernel.

**Exit:** `npm run test:machine` checks all six contract surfaces offline, and documentation explicitly labels unrun empirical claims.

## Phase 1 — schemas and durable audit log

- Publish versioned JSON Schemas for state, semantics, program, proposal, validation decision, checkpoint, migration envelope, and run manifest.
- Canonicalize JSON before hashing; include parent digest, prompt digest, backend identity, and semantics revision in every audit event.
- Make commits append-only and atomic. Keep rejected proposals distinct from committed states.
- Add corruption, replay, incompatible-version, and unknown-axis tests.

**Exit:** schema/property tests cover valid and adversarial fixtures; checkpoint restoration reproduces byte-equivalent canonical state and semantics.

## Phase 2 — §K execution boundary

- Route provider outputs into proposal objects rather than directly into session state.
- Implement validator plugins for structural, arithmetic, relation, delta, invariant, and program-specific checks.
- Define explicit `commit`, `reject`, `rollback`, `retry`, and `escalate` decisions with bounded retry budgets.
- Remove implicit mutation paths and make certainty one validation input, never the sole commit criterion.

**Exit:** fault-injection integration tests prove that malformed and semantically invalid proposals never become committed state.

## Phase 3 — semantic evolution registry

- Represent \(\Sigma\) as a versioned, semantics-bearing registry with exemplars, scope, dependencies, conflicts, and validators.
- Split evolution into propose → shadow-evaluate → accept/reject → activate.
- Generate held-out discriminating cases before activation and retain the previous revision for rollback.
- Detect axis collisions, ambiguous examples, and semantic downgrade.

**Exit:** paired tests demonstrate that an accepted evolution changes only its declared behavior and rollback restores the prior rule.

## Phase 4 — transport and migration

- Define portable checkpoint envelopes independent of a provider chat transcript.
- Declare `preserved`, `transformed`, and permitted-loss invariant sets for every transport.
- Add natural-language round-trip and backend A→B continuation adapters.
- Refuse migration when target capability or semantics compatibility checks fail.

**Exit:** deterministic adapters preserve declared invariant paths, and live canary runs produce complete migration manifests.

## Phase 5 — experiment generator and blinded scorer

- Generate opaque semantic families with train/mutation/test splits and known oracle results.
- Materialize all four preregistered conditions with balanced budgets and randomized order.
- Implement Wilson intervals, exclusions, paired endpoints, per-backend reports, and immutable raw artifacts.
- Add a `--dry-run` mode that validates manifests without calling providers.

**Exit:** a sealed dry run passes locally; fixture hashes are published before any decisive model call.

## Phase 6 — pilot, freeze, decisive run

- Pilot only on separate rule families; use it to debug infrastructure, not tune thresholds.
- Freeze prompts, scorers, sample sizes, exclusions, and analysis.
- Run the preregistered matrix, publish all failures and deviations, and regenerate reports from raw data.

**Exit:** every property has a numerator, denominator, interval, and control comparison. The conclusion is conjunctive and backend-specific.

## Phase 7 — hardening and reproducibility

- Independent reproduction on separately operated endpoints.
- Fuzz §1/§P/§M and migration envelopes; threat-model prompt injection into EVOLVE and checkpoint payloads.
- Add cost, latency, context-pressure, and semantics-capacity curves.
- Stabilize public APIs only after the experiment reveals which abstractions survive.

**Exit:** a third party can replay scoring from raw artifacts and independently run the protocol from the frozen manifest.

## Near-term iteration queue

1. Replace the scaffold's shape predicate with published JSON Schemas.
2. Connect session checkpoint persistence to semantics revisions without changing current CLI behavior.
3. Add canonical hashing and migration-envelope tests.
4. Build the opaque-rule fixture generator and deterministic oracle.
5. Add dry-run experiment manifests, then pilot on non-decisive fixtures.

No live benchmark belongs in the default unit suite: unit tests must remain offline and deterministic, while empirical runs must be explicit, versioned, and costly by design.
