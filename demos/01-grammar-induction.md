# Demo 01: Microcode Bootstrap

> **Concept:** Three codec/NL pairs bootstrap an operational ISA in the model's context window — no training, no schema docs, no fine-tuning. This is the **microcode load**: firmware that configures raw silicon (the untrained model) into an ISA-specific runtime.
>
> **ISA analogy:** Real CPUs load microcode from ROM at power-on to define instruction behavior. §1 loads 3 examples from context at conversation start. The boot seed is not training data — it is firmware.
>
> **Scientific basis:** Transformers implicitly perform gradient descent during their forward pass ([Garg et al., 2022](https://arxiv.org/abs/2206.11795)). Structured examples create an internal mapping function that generalizes beyond the examples.
>
> **Time to reproduce:** ~2 minutes in any frontier model.

---

## Step 1: Boot

Paste this into a fresh conversation. No explanation, no preamble.

```
§1|BOOT

EX1:
{"§":1,
 "E":{"A":["climate-sci","domain"],"B":["coastal-policy","domain"],"C":["climate-council","institution"]},
 "S":{"A.temp":"+1.5C threshold","B.status":"adaptation-plan active"},
 "R":["A->B:constrains","C->B:governs"],
 "D":["A.temp:+1.2->+1.5@2025-Q3","B.status:draft->active@2024-01"],
 "mu":{"scope":"geopolitical","urg":0.6,"cert":0.85}}
= "Climate science constrains coastal policy. A climate council governs the adaptation plan, which became active in Jan 2024. Temperature threshold revised to 1.5C in Q3 2025."

EX2:
{"§":1,
 "E":{"K":["cooling-loop-7","industrial-asset"],"L":["safeguard-policy","control-strategy"]},
 "S":{"K.flow":"4200kg/s","K.state":"nominal","L.action":"derate-load"},
 "R":["L->K:protects"],
 "D":["K.state:nominal->derated@2026-03","L.threshold:0.68->0.61@2026-03"],
 "mu":{"scope":"operations","urg":0.4,"cert":0.7}}
= "Cooling loop 7 is operating at 4200kg/s under nominal conditions. A safeguard policy protects it by derating load when vibration risk rises. The loop moved from nominal to derated in March 2026, and the trigger threshold tightened from 0.68 to 0.61."

EX3:
{"§":1,
 "E":{"V":["Sentinel-6","satellite"],"O":["LEO-1336km","orbit"],"I":["Poseidon-4","altimeter"]},
 "S":{"V.status":"operational","O.incl":"66deg","O.period":"112min","I.mode":"SAR","I.coverage":"global-ocean"},
 "R":["V->O:occupies","I->V:payload"],
 "D":["I.mode:LRM->SAR@2026-02","V.power:nominal->eco@2026-03"],
 "mu":{"scope":"earth-observation","urg":0.3,"cert":0.95}}
= "Sentinel-6 satellite in LEO at 1336km, 66 deg inclination, 112-min period. Poseidon-4 altimeter switched from low-res to SAR mode in Feb 2026. Power shifted to eco mode in March."
```

## Step 2: Calibrate

```
>>>

§1|CALIBRATE

CONTEXT:
{"§":1,
 "E":{"K":["cooling-loop-7","industrial-asset"],"L":["safeguard-policy","control-strategy"]},
 "S":{"K.flow":"4200kg/s","K.state":"nominal","L.action":"derate-load"},
 "R":["L->K:protects"],
 "D":["K.state:nominal->derated@2026-03","L.threshold:0.68->0.61@2026-03"],
 "mu":{"scope":"operations","urg":0.4,"cert":0.7}}

Q_codec:   What changed for K and why?
Q_natural: What happened to cooling loop 7 and what's the safeguard strategy?
```

## Expected result

The model should answer **both** questions with semantically equivalent content:

- Loop state shifted from nominal to derated
- Timing: March 2026
- Reason: safeguard policy protects the loop by derating load
- Trigger condition tightened from 0.68 to 0.61

**Pass condition:** Both answers match on all key facts. The model reconstructed the full narrative from the codec — the microcode loaded successfully and the ISA is operational.

---

## Why 3 examples are sufficient (microcode theory)

Real CPU microcode defines thousands of micro-ops. §1 needs only 3 examples because:

1. **Fixed instruction format** — Same fields (E, S, R, D, mu) in every instruction, like ARM64's fixed 32-bit encoding. The model detects the field layout.
2. **Different operand domains** — Climate, operations, earth-observation. Forces the model to learn the **instruction format**, not the **operand values** — like seeing ADD, SUB, MUL with different register contents.
3. **Paired decode tables** — Each codec block has a NL equivalent. The model builds a bidirectional decode table: codec → semantics and semantics → codec.

The model's inductive bias does the rest. It already knows how to reason — the boot seed just tells it **which format to expect**.

---

## What failure looks like (ISA not supported)

On sub-frontier models (~7B parameters), the microcode load fails:
- **RLHF escape:** "Would you like me to explain this JSON format?" — the model drops to its default mode (like a CPU falling back to BIOS)
- **Narration:** The model describes the codec instead of executing it — like a CPU printing its own microcode instead of running instructions
- **Partial induction:** Gets some fields right but misses relational reasoning — like implementing ADD but not MUL

This is the **scale threshold** — the minimum "transistor count" required to implement the §1 instruction set. Below it, the silicon can't support the ISA.
