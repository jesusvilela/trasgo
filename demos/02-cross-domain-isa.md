# Demo 02: Cross-Compilation — Same ISA, Different Domains

> **Concept:** §1 is an instruction set architecture. Like how AMD64 doesn't care whether it's running a physics simulation or a database — it executes the same opcodes on different data — §1 executes the same instruction format (E, S, R, D, mu) on any domain.
>
> **ISA analogy:** This demo is **cross-compilation**. The boot seed compiled the ISA on climate/operations/satellite data. Now we run the same ISA on industrial compliance and energy grids. Same "binary format," different "programs." The CPU (model) doesn't need retraining — it already has the microcode.
>
> **Scientific basis:** The codec factors context along its intrinsic dimensions (entities, state, relations, transitions, meta). These dimensions are universal to all domains. The model learned the **instruction format**, not the **operand semantics**.
>
> **Time to reproduce:** ~3 minutes. Requires a booted session (run Demo 01 first, or paste `src/boot.md`).

---

## Setup

Boot the model with the 3 examples from Demo 01 (climate, operations, earth-observation).

Then send the following packets. **Neither domain appeared in the boot seed.**

---

## Test A: Industrial compliance

```
>>>

§1|CONTEXT
{"§":1,
 "E":{"F":["safety-audit-17","compliance-proc"],"G":["plant-7","facility"],"H":["inspectorate-west","regulator"]},
 "S":{"F.status":"under-review","F.fine":"potential-4%-revenue","G.revenue":"420M"},
 "R":["H->G:inspects","F->G:targets"],
 "D":["F.status:notice->under-review@2026-01","H.priority:routine->elevated@2026-02"],
 "mu":{"scope":"regulatory","urg":0.6,"cert":0.65}}

What's the worst case for G?
```

### Expected result

The model should:
- **Derive** the maximum fine: 4% of 420M = ~16.8M (arithmetic from codec fields)
- **Note** the priority escalation (routine to elevated in Feb 2026)
- **Contextualize** the risk (review status, regulatory pressure)

This packet uses entity keys F, G, H — never seen in boot. The model applies the ISA to parse them.

---

## Test B: Energy grid (renewable dispatch)

```
>>>

§1|CONTEXT
{"§":1,
 "E":{"W":["NordWind-IV","wind-farm"],"P":["SolarPark-Elbe","solar-farm"],
      "G":["DE-grid-north","grid-segment"],"B":["LiStore-200","battery"]},
 "S":{"W.capacity":"180MW","W.output":"112MW","W.cf":"0.62",
      "P.capacity":"95MW","P.output":"68MW","P.cf":"0.72",
      "G.demand":"340MW","G.renewable-share":"0.53",
      "B.charge":"78%","B.max":"200MWh"},
 "R":["W->G:feeds","P->G:feeds","B->G:stabilizes","W<->P:complementary"],
 "D":["W.output:145->112@2026-03","B.charge:92->78@2026-03"],
 "mu":{"scope":"energy","urg":0.5,"cert":0.85}}

Current renewable output covers what fraction of demand? What's the storage runway?
```

### Expected result

The model should:
- **Compute** renewable output: W(112) + P(68) = 180MW out of 340MW demand = ~53%
- **Compute** storage runway: 200MWh at 78% = 156MWh available
- **Note** the output decline and storage depletion trend

---

## What this demonstrates

```
Boot = microcode load:   climate    operations    earth-observation
Test = cross-compiled:   compliance  energy-grid

Same ISA. Same instruction format. Different programs running on the same CPU.
```

This is exactly how cross-compilation works:
- Write C code (natural language context)
- Compile to AMD64 (§1 packet on Claude)
- Same code compiles to ARM64 (§1 packet on GPT-4o)
- Both produce the same output (semantic equivalence)

The model didn't memorize domain-specific patterns from the boot — it learned the **instruction format**. Entity keys (F, G, H, W, P, B) are **registers** — the model doesn't care what data they hold, just how to operate on them through the ISA.

§1 packets are **programs**, not **data**. The model is a **CPU**, not a **database**.

---

## Compression observed

| Domain | NL tokens | §1 tokens | Ratio |
|:-------|----------:|----------:|------:|
| Industrial compliance | ~280 | ~65 | 4.3x |
| Energy grid (4 entities) | ~380 | ~85 | 4.5x |
| Energy grid (6 entities) | ~620 | ~130 | 4.8x |

Compression improves with entity count because §1 encodes relations once, while natural language restates them per entity.
