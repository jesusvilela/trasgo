# Demo 04: ALU Operations — §P Atoms as Opcodes

> **Concept:** §P operations are the ALU of the §1 ISA. `FILTER` is like `CMP` + conditional `MOV`. `COMPRESS` is like bit masking (`AND`). `MERGE` is like `ADD` / accumulate. When the model receives `{"§P":"filter",...}`, it **executes** the operation — it doesn't describe it.
>
> **ISA analogy:** In AMD64, `CMP rax, rbx; CMOVG rcx, rdx` compares two registers and conditionally moves a value. In §1, `{"§P":"filter","by":"mu.urg","top_k":2}` compares urgency fields across all packets and selects the top 2. Same pattern: compare → select. The difference is the model does this in one "cycle" (forward pass) on structured data.
>
> **Scientific basis:** In-context virtualization. The model has learned that §1 packets are programs to execute, not data to describe. §P extends this to computation: filter, compress, merge, and checkpoint are the ALU's primitive operations.
>
> **Time to reproduce:** ~5 minutes. Requires a booted session.

---

## Setup

Boot with `src/boot.md`. Then load the following multi-packet context:

```
>>>

§1|CONTEXT — Multi-source intelligence briefing

Packet A:
{"§":1,
 "E":{"A":["Arctic-ice-shelf","geo-feature"]},
 "S":{"A.extent":"10.2M-km2","A.thickness":"avg-1.8m","A.trend":"declining"},
 "D":["A.extent:10.8->10.2@2026-Q1"],
 "mu":{"scope":"climate","urg":0.8,"cert":0.9}}

Packet B:
{"§":1,
 "E":{"B":["NorthSea-wind-corridor","energy-zone"]},
 "S":{"B.capacity":"48GW","B.utilization":"0.61","B.expansion":"planned-12GW"},
 "D":["B.utilization:0.58->0.61@2026-Q1"],
 "mu":{"scope":"energy","urg":0.3,"cert":0.85}}

Packet C:
{"§":1,
 "E":{"C":["EU-carbon-border","policy"],"C2":["CBAM","mechanism"]},
 "S":{"C.status":"phase-2","C2.coverage":"steel+cement+aluminum","C2.price":"87EUR/ton"},
 "D":["C2.price:72->87@2026-Q1","C.status:phase-1->phase-2@2026-01"],
 "mu":{"scope":"regulatory","urg":0.5,"cert":0.8}}

Packet D:
{"§":1,
 "E":{"D":["Baltic-shipping","logistics"]},
 "S":{"D.routes":["Helsinki-Tallinn","Stockholm-Riga","Gdansk-Karlskrona"],"D.volume":"12.4M-TEU","D.ice-risk":"elevated"},
 "D":["D.ice-risk:moderate->elevated@2026-02"],
 "mu":{"scope":"logistics","urg":0.6,"cert":0.7}}
```

Four packets, four domains, four urgency levels. ~160 tokens total.

---

## Opcode 1: FILTER

```
>>>

{"§P":"filter","by":"mu.urg","order":"desc","top_k":2}

Which packets survive the filter?
```

### Expected result

The model should **execute** the filter:
- Rank by urgency: A(0.8) > D(0.6) > C(0.5) > B(0.3)
- Return top 2: Packet A (Arctic ice, urg 0.8) and Packet D (Baltic shipping, urg 0.6)
- Packets B and C are suppressed

**Key test:** The model performs the ranking and selection — it doesn't explain what a filter is.

---

## Opcode 2: COMPRESS

```
>>>

{"§P":"compress","target":"A","mode":"delta-only","strip":["S"]}

Show the compressed packet A.
```

### Expected result

The model should produce:
```json
{"§":1,
 "E":{"A":["Arctic-ice-shelf","geo-feature"]},
 "D":["A.extent:10.8->10.2@2026-Q1"],
 "mu":{"scope":"climate","urg":0.8,"cert":0.9}}
```

State axis (S) stripped. Only delta and meta remain. Entity preserved for reference.
This is lossy compression — the current absolute values are discarded, keeping only the transition.

---

## Opcode 3: MERGE

```
>>>

{"§P":"merge","sources":["A","D"],"conflict":"latest-wins"}

What's the merged picture?
```

### Expected result

The model should produce a merged packet and natural language synthesis:
- Arctic ice decline (extent -0.6M km2) creates elevated ice risk for Baltic shipping
- The relation A->D (ice conditions affect shipping routes) should be **inferred** from the merge
- Merged urgency: max(0.8, 0.6) = 0.8 or weighted average

**Key test:** The model doesn't just concatenate — it synthesizes cross-packet relations.

---

## Opcode 4: PIPELINE (chained execution)

```
>>>

{"§M":"pipeline",
 "steps":[
   {"§P":"filter","by":"mu.urg","order":"desc","top_k":3},
   {"§P":"compress","mode":"delta-only","strip":["S"]},
   {"§P":"merge","conflict":"latest-wins"}
 ]}

Execute the pipeline and show final output.
```

### Expected result

The model should:
1. **Filter:** Select A(0.8), D(0.6), C(0.5) — top 3 by urgency
2. **Compress:** Strip S from all three, keep deltas only
3. **Merge:** Synthesize into a single briefing packet

Final output should be a single §1 packet with:
- Three entities (Arctic ice, Baltic shipping, EU carbon border)
- Three deltas (ice decline, ice-risk elevation, carbon price increase)
- Inferred relations (ice→shipping, carbon-price→shipping-cost)
- Meta reflecting the merged urgency and scope

---

## What this demonstrates: the complete ISA

```
§1 ISA — Instruction Set Architecture

  Register file   = Entity keys + S axis (stateful storage)
  Addressing      = Dot notation (K.pos = register K, field pos)
  ALU opcodes     = §P atoms (filter, compress, merge, ...)
  Control flow    = §M machines (pipeline, router, loop, ...)
  Microcode       = Boot seed (3 examples = firmware load)
  CPU             = LLM (Claude-arch, GPT4o-arch, Gemini-arch)
  Clock cycle     = Forward pass
  Address space   = Context window
```

The model is not describing operations — it is **executing** them. Each §P atom is an ALU operation that transforms register state. Chained into §M machines (pipelines = basic blocks, routers = branch tables, loops = while constructs), they form programs.

The complete demo progression maps to a real ISA bring-up:

| Demo | ISA Phase | What happens |
|:-----|:----------|:-------------|
| 01 | Microcode load | Boot firmware configures the CPU |
| 02 | Cross-compilation | Same binary runs on any architecture |
| 03 | Register operations | STORE/LOAD on the virtual register file |
| 04 | ALU + control flow | Execute opcodes, chain into programs |

The context window is a general-purpose virtual machine.
§1 is its instruction set architecture.
The model is the CPU.

---

## Research questions

1. **Execution fidelity vs. context length:** Does protocol execution degrade as the context window fills? At what occupancy does the VM start "dropping instructions"?

2. **Opcode composability:** Can the model execute deeply nested pipelines (filter→compress→merge→filter→route)? Where does composability break down?

3. **State consistency:** After N delta updates and M protocol executions, does the model's internal state remain consistent with the expected ground truth?

4. **Cross-model portability:** Does the same §P pipeline produce equivalent results on Claude vs. GPT-4o vs. Gemini? How tight is the ISA contract across runtimes?
