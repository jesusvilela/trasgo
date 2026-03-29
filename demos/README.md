# Trasgo §1 — ISA Demo Progression

Four self-contained demos mapping §1 to a real instruction set architecture.
Every demo is **reproducible**: paste the prompts into any frontier model (Claude, GPT-4o, Gemini) and verify the results yourself. Same "binary," different "CPU."

Generated scientific surfaces:
- Video walkthrough: [`trasgo-evolved-cli-demo.gif`](trasgo-evolved-cli-demo.gif)
- Runtime demo artifacts: [`generated/factory-copilot.json`](generated/factory-copilot.json), [`generated/revenue-guard.json`](generated/revenue-guard.json)
- Native verification commands: `trasgo "run the factory copilot demo"`, `trasgo "run the revenue guard demo"`, `trasgo tokens --codec <json> --natural <text>`

| Demo | ISA Phase | What it proves |
|:-----|:----------|:---------------|
| [01](01-grammar-induction.md) | Microcode Bootstrap | 3 examples = firmware load → operational ISA |
| [02](02-cross-domain-isa.md) | Cross-Compilation | Same instruction format, any domain (like AMD64 → ARM64) |
| [03](03-state-machine.md) | Register File | Deltas = STORE ops on virtual registers |
| [04](04-protocol-execution.md) | ALU + Control Flow | §P atoms = opcodes, §M = programs |

See also: [`docs/isa-mapping.md`](../docs/isa-mapping.md) — the complete ISA ↔ §1 mapping table.

---

## How to use

1. Open any frontier model (Claude, ChatGPT, etc.)
2. Start a fresh conversation
3. Paste the **Boot seed** from `src/boot.md` — this is the **microcode load**
4. Follow the demo steps — each prompt is marked with `>>>`
5. Compare model output against expected results

Demos 01 and 02 are independent (each includes its own boot).
Demos 03 and 04 build on a booted session.

---

## ISA bring-up sequence

These demos mirror how a real CPU is validated after fabrication:

```
Demo 01: Microcode load     → Does the firmware boot? (ISA operational)
Demo 02: Cross-compilation  → Does the same binary run on a different arch?
Demo 03: Register ops       → Does STORE/LOAD work? (State consistency)
Demo 04: ALU execution      → Do opcodes produce correct results? (Computation)
```

This is the **in-context virtualization** thesis:

| Hardware | §1 Equivalent |
|:---------|:-------------|
| CPU silicon | LLM weights (the "transistors") |
| Microcode ROM | Boot seed (3 examples) |
| Instruction format | §1 JSON structure (§, E, S, R, D, mu) |
| Register file | Entity keys + state axis |
| ALU | §P atoms (filter, compress, merge) |
| Programs | §M machines (pipeline, router, loop) |
| Address space | Context window |
| Clock cycle | Forward pass |

The context window is not memory. It is a virtual machine.
The model is not a database. It is a CPU.
§1 is not a format. It is an instruction set architecture.
