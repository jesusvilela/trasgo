# The Trasgo Reflective Machine

## Status and claim boundary

This document defines a research target, not a claim that every current Trasgo path already implements it. The repository currently supplies a codec, protocols, orchestration, checkpoint/correction components, and recorded model probes. The deterministic kernel scaffold makes the proposed contracts executable; model-conditioned conformance remains an empirical question governed by the [preregistration](reflective-machine-preregistration.md).

**Trasgo Reflective Machine (TRM).** A bounded, stochastic, self-extensible abstract machine instantiated on a frozen generative model, whose operational semantics are induced from examples in its working context rather than being completely hard-coded in the host executor.

**Example-Induced Semantic Machine (EISM).** The broader class of machines satisfying the same definition without depending on Trasgo's particular §1 representation or §P vocabulary.

## Machine tuple

Let

\[
\mathcal T_M=\langle M,W,\Sigma,X,P,H,V,\mathcal R\rangle
\]

where:

| Symbol | Meaning |
|---|---|
| \(M\) | frozen model, including an immutable model/version identifier during a run |
| \(W\) | bounded context workspace |
| \(\Sigma_t\) | induced operational semantics at step \(t\) |
| \(X_t\) | semantic state, normally containing `E`, `S`, `R`, `Δ`, `μ`, optional `ERR`, and evolved axes |
| \(P_t\) | executing §P instruction or §M program/topology |
| \(H_t\) | checkpoint, fork, and audit history |
| \(V\) | externalized validation and commit policy |
| \(\mathcal R\) | available execution backends |

The model produces a **proposal**, not an automatically committed world state:

\[
(\Sigma_t,X_t,P_t)\xrightarrow{M,r}(\widetilde X_{t+1},o_t)
\xrightarrow V
\begin{cases}
(\Sigma_t,X_{t+1})&\text{commit}\\
(\Sigma_{t+1},X_{cp})&\text{rollback, EVOLVE, retry}\\
\bot&\text{halt or escalate.}
\end{cases}
\]

The random variable \(r\) includes sampling and provider nondeterminism. A run record must therefore identify prompts, model/version, decoding parameters, trials, and exclusions.

## §K: the induced semantic kernel

The LLM is a substrate; it is not by itself the TRM. **§K** names the kernel formed by the boot exemplars, induced semantics, transition proposal boundary, verifier, checkpoint store, evolution operation, and commit/rollback policy.

```text
§M  program / topology
 │   pipeline · loop · mesh · broker
§P  transition algebra
 │   route · merge · validate · checkpoint · ...
§1  semantic state IR
 │   E · S · R · Δ · μ · ERR · evolved axes
§K  induced semantic kernel
 │   Σ · propose · verify · evolve · commit · rollback
 M  frozen generative substrate
```

This distinction prevents two category errors: describing §M as the hardware, and treating unvalidated text generation as a machine transition.

## Writable semantics

Boot induces an initial finite semantics from an arbitrary finite exemplar set \(B\):

\[
\Sigma_0=\operatorname{Induce}_M(B).
\]

EVOLVE supplies a worked example \(e\) and proposes:

\[
\Sigma_{t+1}=\operatorname{Induce}_M(\Sigma_t\cup\{e\}).
\]

The extension is operative only after validation. It must affect held-out executions, persist in checkpoints, and require neither a weight update nor a host-code change. Merely echoing the new axis does not demonstrate reflectivity.

## Computation as verified transport

TRM computation transports and rewrites structured state under declared invariants:

\[
T_{a\rightarrow b}^{\Sigma_t}(X)=(X',I_{preserved},I_{transformed},I_{lost},[R]).
\]

Codec-to-language, language-to-codec, parent-to-fork, full-to-delta state, and backend migration share this interface. Every transport declares its invariant paths before execution; post-hoc selection of invariants is not admissible evidence.

In compact form:

\[
\operatorname{COMPUTE}=\operatorname{TRANSPORT}+\operatorname{REWRITE}+\operatorname{VERIFY}+\operatorname{COMMIT}.
\]

## Conformance properties

1. **Inducibility:** finite exemplars install previously unseen semantics that pass held-out programs.
2. **Operational closure:** every committed instruction yields another well-formed state.
3. **Reflectivity:** EVOLVE changes paired, unseen post-extension behavior without model-weight or host-code changes.
4. **Transport invariance:** preregistered invariants survive representation and cross-model round trips.
5. **Recoverability:** injected invalid transitions are rejected, rolled back, and recomputed from a checkpoint.
6. **Substrate portability:** a checkpoint, semantics, and program migrate to another sufficiently capable backend and continue while preserving declared invariants.

The six properties are conjunctive. Failure of one cannot be hidden by a composite average. Passing the offline scaffold only verifies host-side contract mechanics; it does not establish these empirical properties for an LLM.

## Reference scaffold

[`src/machine/kernel.mjs`](../src/machine/kernel.mjs) supplies deliberately small, deterministic reference operations:

- structural membership in the §1 state space;
- installation of exactly one new custom axis from an EVOLVE example;
- proposal/validation/commit separation;
- semantics-bearing checkpoints and backend restoration;
- explicit invariant comparisons and audit records.

It is an oracle for the experimental harness, not a replacement for model execution. Run `npm run test:machine` to validate that contract.

## Non-claims

- The current boot size or instruction count is an implementation snapshot, not an axiom.
- A successful trace is not proof of Turing completeness, general self-verification, or semantic losslessness.
- A backend name without a version and run manifest is not a reproducible substrate.
- Self-reported certainty is an observed field, not calibrated probability unless separately demonstrated.
- Portability requires a true cross-backend continuation, not replay on the originating model.
