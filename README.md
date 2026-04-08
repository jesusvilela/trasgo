<p align="center">
  <img src="assets/trasgo.png" alt="Trasgo" width="280"/>
</p>

<h1 align="center">TRASGO §1</h1>

<p align="center">
  <strong>Teach any LLM a compact context language — in 3 examples, 0 training.</strong>
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
  <img src="https://img.shields.io/badge/dependencies-zero-brightgreen.svg" alt="Zero dependencies"/>
</p>

---

## What is Trasgo?

<p align="center">
  <img src="https://raw.githubusercontent.com/jesusvilela/trasgo/main/assets/trasgo-s1-codec-demo.gif" alt="Trasgo §1 Codec Demo" width="800"/>
</p>

Trasgo is a self-initializing context compression codec and in-context reasoning protocol that treats the LLM context window as an active computational substrate. By factoring verbose natural language into a compact, multidimensional JSON representation (§1), it enables frontier models to induce a dense logic grammar from just three examples, effectively turning the forward pass of the transformer into a self-calibrating semantic runtime.

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

This trajectory proves that the model isn't just "chatting"—it is executing a formal verification loop where the codec acts as an Instruction Set Architecture (ISA).

---

## Quick Start

**Step 1.** Paste [`src/boot.md`](src/boot.md) into any frontier model's context window.

**Step 2.** The model reads 3 codec↔natural language pairs and induces the grammar.

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

---

## Architecture

Trasgo defines a three-layer stack that transforms an LLM into a virtual machine.

```
┌─────────────────────────────────────────────────────────┐
│                     §1 CODEC LAYER                       │
│                                                          │
│  3 examples → grammar induction → operational codec      │
│  E · S · R · Δ · μ  +  evolvable custom axes            │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                   §P PROTOCOL LAYER                      │
│                                                          │
│  route · compress · decompress · filter · validate       │
│  merge · checkpoint · fork · balance                     │
│  (each self-initializes from 1 example)                  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                  §M MACHINE LAYER                        │
│                                                          │
│  pipeline · router · agent · mesh · loop · broker        │
│  (composable — machines contain machines)                │
│                                                          │
│  The LLM is the runtime. JSON is the instruction set.    │
└─────────────────────────────────────────────────────────┘
```

### The LLM is the Runtime. JSON is the Instruction Set.

Unlike traditional frameworks, Trasgo does not "process" strings for the model. It teaches the model to **think in codec**.
- **§1 Codec:** Lossless dimensional factoring of relational context.
- **§P Protocol:** Atomic operations (opcodes) for context manipulation.
- **§M Machines:** Composable topologies (VM configurations) for multi-agent orchestration.

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

Install surfaces:

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

### Formal Verification (T8)

The system is **T8-Verified** for bounded Turing Completeness. In the FACT THREE probe, the model autonomously managed context window pressure to compute a recursive factorial.

| Capability | Test | Result | Status |
|:-----------|:-----|:------:|:-------|
| Lambda Calculus | V1-V2 | ✓ | PASS |
| Correction Loop | V3 | ✓ | PASS |
| Protocol Evolution | V4 | ✓ | PASS |
| Church Arithmetic | V5 | ✓ | PASS |
| **Recursive Factorial** | **T8** | **✓** | **VERIFIED** |

> **Finding:** FM3 (Depth Collapse) triggers at recursive depth ~2 on frontier models. The Trasgo harness autonomously issues `§P|CHECKPOINT` to compress state and resume, extending effective depth.

---

## Theory

The deep connection: context is a **fiber bundle**. The base space is the entity-relation graph (low-dimensional, invariant). The fiber at each point is the elaboration — natural language, qualifiers, pragmatic framing. A §1 packet is a **section** in base coordinates. The LLM performs the **lift**.

→ [`docs/theory.md`](docs/theory.md)

---

## License

MIT — Jesús Vilela Jato, 2026
