<p align="center">
  <img src="assets/trasgo.png" alt="Trasgo" width="280"/>
</p>

<h1 align="center">TRASGO §1</h1>

<p align="center">
  <strong>Teach any LLM a compact context language — in 3 examples, 0 training.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#examples">Examples</a> ·
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

Trasgo is a **self-initializing context compression codec** for large language models. It factors verbose natural language context into a compact, multidimensional JSON representation that frontier LLMs can read, reason over, and generate natively — after seeing just **3 examples**.

No fine-tuning. No LoRA. No embeddings. No dependencies. No middleware.  
The context window **is** the compiler.

```
520 tokens of natural language  →  §1 codec  →  85 tokens (6× compression)
                                      ↑
                        3 examples in the prompt
                        model induces the grammar
                        zero training required
```

> **Trasgo** — In Spanish folklore, a mischievous household spirit that rearranges  
> things while you're not looking. This one rearranges your context.

---

## Quick Start

**Step 1.** Paste [`src/boot.md`](src/boot.md) into any frontier model's context window.

**Step 2.** The model reads 3 codec↔natural language pairs and induces the grammar.

**Step 3.** Run the calibration query:

```
Q_codec:   What changed for K and why?
Q_natural: What happened to the Tesla position and what's the hedging strategy?
```

**Step 4.** If both answers match semantically → codec is live. Start sending context as §1 packets:

```json
{"§":1,
 "E":{"N":["startup-founder","person","Berlin"]},
 "S":{"N.funding":"seed-2.1M€","N.domains":["MLOps","infra","data"]},
 "R":["N→X:founded"],
 "Δ":["X.stage:idea→mvp@2026-01"],
 "μ":{"scope":"business","urg":0.6,"cert":0.85}}
```

The model reads this at native speed. No decompression step. It **thinks** in codec.

---

## CLI Layer

Trasgo now supports a top-level CLI layer that sits above the model runtime:

```text
trasgo -> local/cloud LLM runtime
```

Use it as the orchestration surface for admin control, session runtime execution, MCP/skill mounting, dashboarding, benchmarking, and calibration:

```bash
trasgo init "portfolio runtime"
trasgo pack --out .trasgo-runtime/packs/portfolio.json
trasgo boot --from .trasgo-runtime/packs/portfolio.json
trasgo send "What changed for K and why?"
trasgo status
trasgo doctor --probe
trasgo runtimes
trasgo tools
trasgo mcp
trasgo skills
trasgo session new
trasgo --session <id> send "§P|BALANCE ..."
trasgo --session <id> send "What changed for K and why?"
trasgo serve --stdio
trasgo live
trasgo bench lmstudio
trasgo bench deepseek --json --validate
trasgo calibrate
```

Repo-local launchers are included:
- macOS / Linux: `./bin/trasgo`
- Windows: `.\trasgo.cmd`

Installed or linked via npm, the command is simply `trasgo`.

Banner modes:
- `trasgo --logo auto ...` uses inline graphics when the terminal supports them, otherwise falls back to ASCII.
- `trasgo --logo image ...` forces the image path with ASCII fallback.
- `trasgo --logo ascii ...` keeps the figlet banner.

Primary workflow:

```text
trasgo init -> trasgo pack -> trasgo boot -> trasgo send
```

- `init` seeds a session-first runtime contract and attaches the default boot/protocol context.
- `pack` builds a reusable trasgo bundle from the active session: attached skills, mounted MCP surfaces, `§1|BOOT`, and the current `§P|BALANCE` packet.
- `boot` activates that bundle into a live session, computes the broker decision, and pins the active runtime contract before work is sent.

`trasgo` is now intended to be the runtime shell. The `BALANCE` protocol negotiates a session-scoped local/API contract, seeded from benchmark footprints and refined by observed behavior during the conversation.

---

## How It Works

### The core insight

Natural language context is a high-dimensional structure smeared into a serial token stream. Most tokens are structural redundancy — articles, hedging, restatement, connective tissue.

Trasgo factors the stream into its **intrinsic dimensions**:

| Axis | Symbol | Encodes |
|:-----|:------:|:--------|
| Entities | `E` | Who/what nodes with type and location |
| State | `S` | Current attribute values per entity |
| Relations | `R` | Directed edges: causal, temporal, hierarchical |
| Deltas | `Δ` | What changed and when |
| Meta | `μ` | Scope, urgency, certainty, resolution, TTL |

### Self-initialization via in-context learning

Transformers implicitly implement gradient descent in their forward pass ([Garg et al., 2022](https://arxiv.org/abs/2206.11795)). When Trasgo feeds structured codec examples, the model constructs an internal mapping function `codec → semantics` that **generalizes to unseen packets**.

Three examples are sufficient because:
- The codec has **consistent structure** (same axes, same notation)
- The model's inductive bias favors **compositional mappings**
- Each example demonstrates a **different domain** (climate, finance, earth-observation) — forcing the model to learn the structure, not the content

### Mid-conversation evolution

New axes can be introduced at any time with **one example**:

```
EX_EVO:
{"§":1,"E":{...},...,"ρ":{"source":"experiment","peer-reviewed":false}}
= "ρ axis tracks information provenance."
```

One example. The model now knows `ρ`. No schema update. No version bump. No reboot.

---

## Architecture

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

### Protocol atoms (`§P`)

Nine atomic operations, each learned from a single example:

| Protocol | Function |
|:---------|:---------|
| `route` | Conditional context activation/suppression by field matching |
| `compress` | Re-encode to Δ-only, strip axes, optional checkpoint |
| `decompress` | Expand entity to natural language at specified depth |
| `filter` | Budget-ranked top-k selection of packets |
| `merge` | Multi-source Δ-union with conflict resolution |
| `checkpoint` | Snapshot state for rollback |
| `fork` | Create isolated context branches |
| `validate` | Detect and correct response errors against packet state |
| `balance` | Negotiate local/API runtime contract for subsequent turns |

### Hyperprotocol machines (`§M`)

Six composable topologies:

| Machine | Topology |
|:--------|:---------|
| `pipeline` | Sequential `§P` chain |
| `router` | First-match dispatch to named pipes |
| `agent` | Self-contained unit with boot, budget, and role |
| `mesh` | Multi-agent topology with typed edges |
| `loop` | Iterative refinement with certainty-based exit |
| `broker` | Runtime dispatch across negotiated local/API targets |

---

## Demo Progression

Four self-contained demos building from data to computation. Each is reproducible — paste into any frontier model.

| # | Demo | Concept |
|:-:|:-----|:--------|
| 01 | [Grammar Induction](demos/01-grammar-induction.md) | 3 examples → operational codec |
| 02 | [Cross-Domain ISA](demos/02-cross-domain-isa.md) | Same instruction set, any domain |
| 03 | [State Machine](demos/03-state-machine.md) | Deltas as state transitions |
| 04 | [Protocol Execution](demos/04-protocol-execution.md) | §P atoms as VM opcodes |

---

## Examples

### Single-domain session

Load an energy grid context, query dispatch strategy, receive a delta update:

→ [`examples/single-domain.md`](examples/single-domain.md)

### Multi-agent mesh

Three agents (market analyst, legal analyst, synthesizer) in a fan-in topology, communicating via §1-Δ packets:

→ [`examples/multi-agent.md`](examples/multi-agent.md)

### Mid-conversation evolution

Add provenance (`ρ`) and confidence decay (`τ`) axes to a live session:

→ [`examples/evolution.md`](examples/evolution.md)

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

*\*MedGemma 27B unloaded mid-testing. Prior session confirmed cross-domain GDPR transfer (3/3).*

The 7B model recognized JSON but failed semantic induction (RLHF persona escape). **At 27B, self-initialization emerges.** The sharpest finding: protocol FILTER (§P opcode execution) is consistently the hardest capability — even models that pass everything else struggle with it. Only frontier models execute §P reliably. DeepSeek-V3 confirmed via API benchmark (5,369 tokens, 84% overall) and independently via user test on the Android mobile app, where it spontaneously extended §1 with novel `conflicts` and `synthesis` axes.

Full cross-model test protocol: [`tests/scale-threshold.md`](tests/scale-threshold.md)

### Observed compression

| Context type | NL tokens | §1 tokens | Ratio |
|:-------------|----------:|----------:|------:|
| Single entity + state | ~120 | ~30 | 4× |
| Multi-entity + relations | ~520 | ~85 | 6× |
| Delta update (state change) | ~80 | ~25 | 3× |
| Full domain context (energy grid) | ~800 | ~120 | 7× |

*Ratios are approximate and domain-dependent. Systematic benchmarking is ongoing.*

---

## Repository structure

```
trasgo/
├── src/
│   ├── boot.md              §1 codec boot seed (paste this first)
│   ├── hyperprotocol.md     §P protocols + §M machines
│   └── mode-lock.md         RLHF escape prevention
├── demos/
│   ├── 01-grammar-induction.md   3 examples → operational codec
│   ├── 02-cross-domain-isa.md    Same ISA, any domain
│   ├── 03-state-machine.md       Deltas as state transitions
│   └── 04-protocol-execution.md  §P atoms as VM opcodes
├── examples/
│   ├── single-domain.md     Energy grid session
│   ├── multi-agent.md       Mesh topology walkthrough
│   └── evolution.md         Mid-conversation axis extension
├── docs/
│   ├── theory.md            Information-theoretic foundations
│   ├── isa-mapping.md       §1 ↔ hardware ISA mapping (AMD64/ARM64 analogies)
│   ├── codec-grammar.md     Full grammar reference (human-only — never paste to model)
│   └── field-map.md         Where Trasgo fits in the compression landscape
├── tests/
│   ├── calibration-suite.md 5-test validation battery
│   ├── scale-threshold.md   Cross-model comparison protocol
│   ├── run_calibration.py   API-based calibration runner
│   ├── run_structured.py    Structured output enforcement test
│   ├── bench_online.py      Online API benchmark (DeepSeek, OpenRouter, etc.)
│   └── research_runner.py   Full 9-test automated research suite
├── assets/
│   └── trasgo.png           Project logo
├── LICENSE                  MIT
└── README.md
```

---

## What Trasgo is NOT

| Not this | But this |
|:---------|:---------|
| Prompt pruning (LLMLingua) | Representational re-encoding |
| Soft prompt compression | Zero-training in-context induction |
| KV-cache optimization | Prompt-level, model-agnostic |
| Summarization | Lossless dimensional factoring |
| A library to install | A protocol to paste |

See [`docs/field-map.md`](docs/field-map.md) for detailed positioning against the 2024–2026 compression landscape.

---

## Open questions

- **Compression-fidelity frontier.** Exact curve of compression ratio vs. semantic accuracy across domains and model scales.
- **Scale threshold mapping.** Where between 7B and frontier does self-initialization emerge? (14B? 32B? 70B?)
- **Mode-lock robustness.** Can RLHF persona escape be fully suppressed across providers?
- **Cross-provider portability.** Same boot seed, different models — does the induced codec transfer?
- **Multi-turn persistence.** How does codec comprehension degrade over very long sessions?
- **Codec-native reasoning.** Does the model reason *better* from compressed representations (noise filtering effect)?

---

## Theory

The deep connection: context is a **fiber bundle**. The base space is the entity-relation graph (low-dimensional, invariant). The fiber at each point is the elaboration — natural language, qualifiers, pragmatic framing. A §1 packet is a **section** in base coordinates. The LLM performs the **lift**.

The model doesn't need geometry in its weights. It needs geometry in its **input structure**, and it reconstructs the rest.

→ [`docs/theory.md`](docs/theory.md)

---

## License

MIT — Jesús Vilela Jato, 2026
