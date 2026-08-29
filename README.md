<p align="center">
  <img src="assets/trasgo.png" alt="Trasgo" width="280"/>
</p>

<h1 align="center">TRASGO §1</h1>

<p align="center">
  <strong>Induce a compact context language from finite examples — no weight updates.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#the-key-result">Key Result</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#results">Results</a> ·
  <a href="docs/theory.md">Theory</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/status-experimental-orange.svg" alt="Status: experimental"/>
  <img src="https://img.shields.io/badge/training-none_required-brightgreen.svg" alt="No training required"/>
  <img src="https://img.shields.io/badge/runtime-Node_20%2B-5fa04e.svg" alt="Node.js 20 or newer"/>
</p>

---

## What is Trasgo?

<p align="center">
  <img src="https://raw.githubusercontent.com/jesusvilela/trasgo/main/assets/trasgo-s1-codec-demo.gif" alt="Trasgo §1 Codec Demo" width="800"/>
</p>

Trasgo is an experimental context codec and in-context reasoning protocol. It factors natural-language context into compact §1 JSON packets, then uses worked examples to help a capable LLM infer the packet grammar inside its existing context window—without fine-tuning or weight updates.

The repository contains the codec specification, a Node.js orchestration CLI, an optional Rust runtime, offline verification fixtures, demonstrations, and recorded model evaluations. The current boot seed has four examples; exemplar count is an implementation parameter, not a universal guarantee. Behavior depends on model, prompt, and task.

---

## The Key Result: Autonomous Self-Correction

The Trasgo protocol allows LLMs to detect their own reasoning failures by encoding uncertainty as a first-class signal. In the **V2 Capture-Avoidance Test**, the model reduces a Lambda calculus redex `(λx.λy.x) y`. A naive substitution would lead to variable capture (`λy.y`), but Trasgo's `μ.cert` axis forces the model to monitor structural integrity.

### V2 Demo Trajectory: (λx.λy.x) y

When the model detects a name clash during substitution, its certainty (`cert`) drops, triggering an autonomous **Correction Turn (CT)** to alpha-rename the bound variable before proceeding.

```text
cert
1.0 ●─────────────────────────────────────────● 1.0 (Normal Form: λz.y)
                                          ●─── 0.95 (Safe reduction)
0.5 ──────────────────────────────────────────
0.4                          ●  FM1 detected (Capture Risk)
0.0 ────────────────────────────────────────────→ steps
     encode    clash-detected  alpha-rename  reduce
```

This trajectory is evidence that the tested model followed the correction protocol on this bounded fixture. It does not by itself establish general self-verification; treat the ISA framing as a useful systems analogy and an experimental hypothesis.

---

## Quick Start

### Prompt-only path

**Step 1.** Paste [`src/boot.md`](src/boot.md) into a capable instruction-following model's context window.

**Step 2.** The model reads the current finite boot exemplar set (four examples) and attempts to induce the grammar.

**Step 3.** Run the calibration query:

```
Q_codec:   What changed for K and why?
Q_natural: What happened to cooling loop 7 and what's the safeguard strategy?
```

**Step 4.** If both answers match semantically → codec is live. Start sending context as §1 packets:

```json
{"§":1,
 "E":{"N":["edge-cluster-7","compute-node"],"X":["vision-service","workload"]},
 "S":{"N.capacity":"12GPU","N.domains":["vision","telemetry","ops"]},
 "R":["N→X:hosts"],
 "Δ":["X.stage:staging→active@2026-01"],
 "μ":{"scope":"operations","urg":0.6,"cert":0.85}}
```

### CLI path

Requirements: Node.js 20+. Rust is optional unless you want the native runtime.

```bash
npm install -g trasgo
trasgo quickstart
trasgo doctor
```

For a source checkout:

```bash
npm ci
npm test
npm run quickstart
```

---

## Architecture

Trasgo's research architecture distinguishes programs from the induced kernel that executes them. The LLM is the generative substrate; §K is the proposed machine boundary.

```
┌─────────────────────────────────────────────────────────┐
│                  §M PROGRAM / TOPOLOGY                   │
│        pipeline · router · agent · mesh · loop           │
│                                                          │
│                 §P TRANSITION ALGEBRA                    │
│ route · compress · merge · validate · checkpoint · ...   │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                  §1 SEMANTIC STATE IR                    │
│                                                          │
│       E · S · R · Δ · μ · ERR · evolved axes            │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                §K INDUCED SEMANTIC KERNEL                │
│                                                          │
│    Σ · propose · verify · evolve · commit · rollback     │
├─────────────────────────────────────────────────────────┤
│             FROZEN GENERATIVE SUBSTRATE                  │
└─────────────────────────────────────────────────────────┘
```

### The LLM is the substrate. §K is the research machine.

Unlike traditional frameworks, Trasgo uses in-context examples to elicit codec operations from the model and validates the resulting transition proposals.
- **§1 Codec:** Compact dimensional factoring of relational context. Losslessness is task- and packet-dependent and should be checked with round-trip evaluation.
- **§P Protocol:** Atomic operations (opcodes) for context manipulation.
- **§M Machines:** Composable topologies (VM configurations) for multi-agent orchestration.

The full definition, falsifiable conformance properties, and claim boundaries are in [`docs/trasgo-machine.md`](docs/trasgo-machine.md). The decisive cross-backend experiment is specified in the [`preregistration`](docs/reflective-machine-preregistration.md), with staged engineering work in the [`implementation roadmap`](docs/reflective-machine-roadmap.md).

---

## CLI: The Orchestration Surface

<p align="center">
  <img src="https://raw.githubusercontent.com/jesusvilela/trasgo/main/assets/trasgo-live-demo.gif" alt="Trasgo CLI Demo" width="800"/>
</p>

The `trasgo` CLI acts as the host operating system for the semantic runtime. It manages session persistence, tracks certainty trajectories, and brokers between local and cloud runtimes.

```bash
trasgo init "portfolio runtime"
trasgo pack --out .trasgo-runtime/packs/portfolio.json
trasgo boot --from .trasgo-runtime/packs/portfolio.json
trasgo send "What changed for K and why?"
trasgo verify --all
trasgo status
```

Installation surfaces:

```bash
# npm
npm install -g trasgo

# native Rust
cargo build --manifest-path rust/trasgo/Cargo.toml --release
```

---

## Results

### Scale threshold

Self-initialization is an **emergent capability** with a sharp scale threshold:

| Model | Params | Runtime | Calibrate | Cross-domain | State | Protocol | Classification |
|:------|:------:|:--------|:---------:|:------------:|:-----:|:--------:|:---------------|
| MedGemma 4B | 4B | LM Studio | ✗ | ✗ | ✓ | ✗ | Failed |
| Qwen2.5-7B | 7B | LM Studio | ✗ | ✗ | ✗ | ✗ | Failed |
| MedGemma 27B | 27B | LM Studio | ✓ (3/4) | partial* | ✓ | partial* | Partial |
| rnj-1-instruct | local | LM Studio | ✓ (3/4) | ✓ (3/3) | ✓ (10/10) | ✗ (1/4) | **§1-advanced** |
| DeepSeek-V3 | 671B MoE | API | ✓ (3/4) | ✓ (3/3) | ✓ (4/4) | ✗ (1/3) | **§1-advanced** |
| GPT-4o | frontier | OpenAI API | ✓ (3/3) | ✓ (3/3) | ✓ | ✓ | **§1-advanced** |
| Claude Opus | frontier | Anthropic API | ✓ (3/3) | ✓ (3/3) | ✓ | ✓ | **§1-advanced** |

### Bounded formal-reasoning probes (T8)

The repository records a passing **T8 bounded recursive-factorial probe**. This demonstrates execution of the tested trace under the recorded conditions; it is not a proof that an LLM or Trasgo is Turing-complete, nor a guarantee of general formal correctness.

| Capability | Test | Result | Status |
|:-----------|:-----|:------:|:-------|
| Lambda Calculus | V1-V2 | ✓ | PASS |
| Correction Loop | V3 | ✓ | PASS |
| Protocol Evolution | V4 | ✓ | PASS |
| Church Arithmetic | V5 | ✓ | PASS |
| **Recursive Factorial** | **T8** | **✓** | **Recorded pass** |

> **Finding:** FM3 (Depth Collapse) triggers at recursive depth ~2 on frontier models. The Trasgo harness autonomously issues `§P|CHECKPOINT` to compress state and resume, extending effective depth.

Results above are repository-recorded experiments, not independently reproduced benchmarks. Model names, endpoints, prompts, and outputs can drift; see [`src/tests/`](src/tests/) and [`docs/foundations.md`](docs/foundations.md) before comparing systems or citing a result.

---

## Theory

The deep connection: context is a **fiber bundle**. The base space is the entity-relation graph (low-dimensional, invariant). The fiber at each point is the elaboration — natural language, qualifiers, pragmatic framing. A §1 packet is a **section** in base coordinates. The LLM performs the **lift**.

→ [`docs/theory.md`](docs/theory.md)

---

## License

MIT — Jesús Vilela Jato, 2026
