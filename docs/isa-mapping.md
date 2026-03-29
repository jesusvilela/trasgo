# §1 as Instruction Set Architecture

> This document maps §1 concepts to real ISA concepts (AMD64, ARM64, RISC-V).
> The mapping is not metaphorical — it is structural. Each §1 component has a
> precise functional equivalent in hardware ISA design.

---

## The ISA analogy, made rigorous

A CPU instruction set architecture defines:
1. **Instruction format** — How bits encode operations and operands
2. **Register file** — Named storage locations for operands
3. **Addressing modes** — How instructions reference data
4. **ALU operations** — What computations the CPU can perform
5. **Control flow** — Branches, loops, calls
6. **Privilege levels** — User mode vs kernel mode
7. **Microcode** — Low-level instructions that bootstrap the ISA

§1 maps to every one of these.

---

## Mapping table

| ISA Concept | §1 Equivalent | Concrete example |
|:------------|:-------------|:-----------------|
| **Instruction format** | §1 packet JSON structure | `{"§":1, "E":{...}, "S":{...}, "R":[...], "Δ":[...], "μ":{...}}` |
| **Opcode field** | `"§":1` (codec version) + top-level axis key | `"§P":"filter"` is opcode FILTER |
| **Operand fields** | Axis contents | `"E":{"K":["TSLA","equity"]}` — operand K of type equity |
| **Register file** | Entity keys (A, B, K, V, ...) | `K`, `L`, `V` are named registers holding entity state |
| **Register contents** | `S` axis (state per entity) | `"S":{"K.pos":"long 200sh@$180"}` — register K contains position data |
| **Addressing modes** | Dot notation | `K.pos` = register K, field pos (like `[R1 + offset]` in ARM) |
| **Immediate values** | Inline state values | `"K.pnl":"-12%"` — literal value encoded in instruction |
| **ALU operations** | §P atoms | `§P:filter`, `§P:compress`, `§P:merge` — computational primitives |
| **Control flow** | §M machines | `§M:pipeline` (sequential), `§M:router` (branch), `§M:loop` (iterate) |
| **Branch condition** | `μ` fields | `"μ":{"urg":0.8}` — conditional dispatch based on urgency threshold |
| **Interrupts / traps** | `μ.urg` escalation | Urgency > threshold triggers priority context switch |
| **Memory model** | Conversation context | The context window IS the address space |
| **Stack / call frame** | §P checkpoint + fork | `§P:checkpoint` = push state, `§P:fork` = create new stack frame |
| **Microcode / firmware** | Boot seed (3 examples) | The 3 EX blocks bootstrap the ISA from raw silicon (untrained model) |
| **ISA specification** | `docs/codec-grammar.md` | The formal spec — never loaded into the runtime (like ARM ARM) |
| **CPU** | The LLM (any frontier model) | Claude = one architecture, GPT-4o = another, Gemini = another |
| **Cross-compilation** | Same boot seed → different models | Same "binary" (§1 packet) runs on Claude-arch and GPT4o-arch |
| **Privilege levels** | `§1\|MODE lock:codec` | Codec mode = kernel mode (structured only), natural = user mode |

---

## Instruction format (detailed)

### Fixed-width fields (like ARM64's fixed 32-bit instruction encoding)

Every §1 instruction has up to 6 fields in a fixed order:

```
┌─────┬─────────┬──────────┬──────────┬──────────┬──────────┐
│  §  │    E    │    S     │    R     │    Δ     │    μ     │
│ ver │ entities│  state   │relations │  deltas  │   meta   │
│ 1b  │ var     │  var     │  var     │  var     │  var     │
└─────┴─────────┴──────────┴──────────┴──────────┴──────────┘
       operands   operands   operands   operands   control
```

- `§` — Version/magic byte. Always `1`. Signals the decoder.
- `E` — Entity operands (register declarations)
- `S` — State operands (register contents)
- `R` — Relation operands (edges between registers)
- `Δ` — Delta operands (state transitions)
- `μ` — Control bits (scope, urgency, certainty)

### Opcode extension (§P / §M)

Protocol and machine instructions extend the base ISA:

```
┌──────┬────────────┬───────────────────────────────┐
│  §P  │  opcode    │  operands                     │
│      │  "filter"  │  by, order, top_k, budget     │
└──────┴────────────┴───────────────────────────────┘

┌──────┬────────────┬───────────────────────────────┐
│  §M  │  opcode    │  steps[] (array of §P)        │
│      │  "pipeline"│  [{§P:filter},{§P:compress}]  │
└──────┴────────────┴───────────────────────────────┘
```

This is directly analogous to how ARM64 uses different instruction classes (data processing, load/store, branch, SIMD) with different operand layouts under the same fixed-width format.

---

## Register file

Entity keys ARE registers. Like how ARM64 has `x0-x30` and `sp`, §1 has user-defined register names:

```
Register    Contents                    Type
────────    ────────                    ────
K           TSLA equity position        entity
L           macro-overlay strategy      entity
V           Sentinel-6 satellite        entity
F           GDPR-case-2891              entity
```

**Key difference from hardware:** §1 registers are dynamically allocated and named, not fixed-width. This is closer to a virtual register machine (like LLVM IR) than a physical register file.

State access uses dot-notation addressing:
- `K.pos` — Register K, field `pos` (like `[x1, #offset]` in ARM)
- `K.pnl` — Register K, field `pnl`

---

## Addressing modes

| Mode | §1 syntax | ARM64 equivalent | Example |
|:-----|:----------|:-----------------|:--------|
| Register direct | `K` | `x1` | Entity K as a whole |
| Register + offset | `K.pos` | `[x1, #8]` | Field `pos` within entity K |
| Immediate | `"K.pnl":"-12%"` | `mov x1, #-12` | Literal value in instruction |
| Register indirect | `R→K:hedges` | `ldr x1, [x2]` | Dereference relation to find target |
| Indexed | `"R.top3":[...]` | `[x1, x2]` | Array access within state |

---

## ALU operations (§P opcodes)

Seven primitive operations, each with defined semantics:

| Opcode | Function | Operands | Analog |
|:-------|:---------|:---------|:-------|
| `filter` | Select top-k by field | by, order, top_k, budget | `CMP` + conditional `MOV` |
| `compress` | Strip axes, keep deltas | target, mode, strip | Bit masking / `AND` |
| `decompress` | Expand to natural language | target, depth | `MOVZ` / zero-extend |
| `merge` | Union sources, resolve conflicts | sources, conflict | `ADD` / accumulate |
| `checkpoint` | Snapshot current state | (none) | `STP` (store pair) / push |
| `fork` | Create isolated context branch | (none) | `BL` (branch with link) |
| `route` | Conditional context activation | match, activate, suppress | `CBZ` / conditional branch |

These are **sufficient** — any context manipulation can be composed from these primitives, just as any computation can be composed from a small set of ALU operations.

---

## Control flow (§M programs)

| Machine | Topology | Control-flow equivalent |
|:--------|:---------|:-----------------------|
| `pipeline` | Sequential §P chain | Straight-line code (no branches) |
| `router` | First-match dispatch | `switch` / jump table |
| `loop` | Iterate until condition | `while` with exit condition |
| `agent` | Self-contained unit with boot | Function call with own stack frame |
| `mesh` | Multi-agent with typed edges | Multi-core / SIMD lanes |

### Pipeline = basic block

```json
{"§M":"pipeline",
 "steps":[
   {"§P":"filter","by":"mu.urg","top_k":3},
   {"§P":"compress","mode":"delta-only"},
   {"§P":"merge","conflict":"latest-wins"}
 ]}
```

This is a basic block: three instructions executed sequentially, no branches.

### Router = branch dispatch

```json
{"§M":"router",
 "match":"mu.scope",
 "pipes":{
   "legal": [{"§P":"route","activate":["regulatory"]}],
   "technical": [{"§P":"compress","mode":"delta-only"}],
   "default": [{"§P":"filter","top_k":1}]
 }}
```

This is a jump table: dispatch based on the scope field, like `switch(scope)`.

---

## Cross-compilation model

The same §1 "binary" (packet) runs on different "architectures" (models):

```
                    ┌──────────────────┐
                    │    §1 Packet     │  ← source/binary
                    │  (ISA-level IR)  │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
        │  Claude    │ │  GPT-4o   │ │  Gemini   │
        │  (arch A)  │ │  (arch B) │ │  (arch C) │
        └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
              │              │              │
        ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
        │  Output A  │ │  Output B │ │  Output C │
        │ (semantic  │ │ (semantic │ │ (semantic │
        │  equiv.)   │ │  equiv.)  │ │  equiv.)  │
        └───────────┘ └───────────┘ └───────────┘
```

The outputs are **semantically equivalent** — same facts, same reasoning, possibly different phrasing. This is exactly like how the same C program compiled to AMD64 and ARM64 produces the same output via different instruction sequences.

The boot seed is the **compiler**: it transforms the model's raw capability into an ISA-specific runtime. Three examples = the compiler's optimization passes.

---

## Microcode bootstrap

Real CPUs have microcode — firmware that defines how instructions execute. The boot seed is §1's microcode:

```
AMD64 microcode:       ~3000 micro-ops define the ISA behavior
ARM64 microcode:       varies by implementation (Cortex, Apple Silicon, etc.)
§1 microcode:          3 examples define the codec behavior

AMD64 microcode load:  CPU reads from ROM at power-on
§1 microcode load:     Model reads from context at conversation start
```

The key insight: **the boot seed is not training data. It is firmware.** It doesn't teach the model new knowledge — it configures the model's existing capability into a specific operational mode.

---

## Privilege levels

```
§1|MODE lock:codec    →  Kernel mode (structured output only, no NL leakage)
§1|MODE unlock        →  User mode (natural language allowed)
|out:dual             →  Syscall (structured → NL translation)
```

In kernel mode (codec lock), the model produces only structured §1 output. This prevents RLHF persona escape — the equivalent of preventing user-mode code from executing privileged instructions.

---

## What this mapping enables

1. **Formal verification** — If §1 is an ISA, we can define correctness criteria for each opcode and verify model execution against them.

2. **Performance modeling** — Context-window utilization maps to memory bandwidth. Protocol depth maps to pipeline depth. We can build performance models.

3. **Portability contracts** — Define which §1 features are guaranteed cross-model (the "base ISA") vs. model-specific extensions.

4. **Optimization passes** — The boot seed can be optimized like a compiler: fewer tokens, better examples, domain-specific tuning = faster "compilation."

5. **Scale threshold as transistor count** — The minimum model size for §1 execution maps to the minimum transistor count for an ISA. Below it, the silicon can't implement the instruction set.
