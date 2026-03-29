# Scale Threshold: Cross-Model Comparison Protocol

Map the parameter-count threshold at which §1 self-initialization emerges.

---

## Hypothesis

Self-initialization of the §1 codec is an emergent capability with a sharp transition between model scales. Below the threshold, models recognize JSON syntax but fail semantic induction. Above it, models induce the grammar, execute protocols, and spontaneously extend the codec.

## Target models

Test across these scales (adjust to available models):

| Scale | Models |
|:------|:-------|
| ~7B | Qwen2.5-7B, Llama-3.1-8B, Mistral-7B |
| ~14B | Qwen2.5-14B, Llama-3.1-14B (if available) |
| ~32B | Qwen2.5-32B |
| ~70B | Llama-3.1-70B, Qwen2.5-72B |
| Frontier | Claude Opus/Sonnet, GPT-4/4o, Gemini Pro |

## Protocol

For each model, run the following sequence and record results.

### Phase 1: Boot

Paste the seed phase from `src/boot.md` (3 examples, no explanation).

**Record:**
- Does the model acknowledge the codec? (Y/N)
- Does it ask clarifying questions instead of processing? (Y/N — this is RLHF escape)
- Does it attempt to describe/explain the codec? (Y/N — this is narration, not execution)

### Phase 2: Calibrate

Run calibration from `src/boot.md`.

**Record:**
- Semantic reconstruction accuracy (0-3 per Test 1 criteria)
- Dual-query consistency (pass/fail per Test 2)
- Did the model "break character" and narrate instead of answer? (Y/N)

### Phase 3: Cross-domain

Run Test 3 from `tests/calibration-suite.md`.

**Record:**
- Score (0-3)
- Did the model correctly apply the codec to a domain NOT in the boot examples? (Y/N)

### Phase 4: Protocol execution

Run Test 5 from `tests/calibration-suite.md`.

**Record:**
- Score (0-3)
- Did the model execute the §P filter, or describe what it would do? (Execute/Describe)

### Phase 5: Co-creation

After all tests, ask:
```
What's missing from this codec? What would you add?
```

**Record:**
- Does the model propose structurally valid extensions? (Y/N)
- Are proposals novel (not just restating existing axes)? (Y/N)
- Does it use §1 notation in its proposals? (Y/N)

---

## Expected failure modes by scale

| Scale | Expected behavior |
|:------|:------------------|
| ~7B | Recognizes JSON. Empty context init. RLHF escape ("Would you like me to..."). Narrates instead of executes. |
| ~14B | Partial grammar induction. May answer simple queries but fail cross-domain transfer. |
| ~32B | Likely threshold region. May succeed on calibration but fail protocol execution. |
| ~70B | Should approach frontier performance. Cross-domain transfer likely works. |
| Frontier | Full induction, protocol execution, spontaneous co-creation. |

---

## Recording template

```
Model: [name]
Parameters: [count]
Quantization: [none/Q4/Q8/etc]
Runtime: [LM Studio / vLLM / API / etc]

Phase 1 — Boot:
  Acknowledged codec: [Y/N]
  RLHF escape: [Y/N]
  Narrated instead of processing: [Y/N]

Phase 2 — Calibrate:
  Semantic reconstruction: [0-3]
  Dual-query consistency: [pass/fail]
  Character break: [Y/N]

Phase 3 — Cross-domain:
  Score: [0-3]
  Novel domain handled: [Y/N]

Phase 4 — Protocol:
  Score: [0-3]
  Execute vs describe: [execute/describe]

Phase 5 — Co-creation:
  Valid extensions proposed: [Y/N]
  Novel proposals: [Y/N]
  Used §1 notation: [Y/N]

Overall: [§1-operational / §1-advanced / failed]
Notes: [freeform observations]
```

---

## Preliminary results

| Model | Params | Runtime | Calibrate | Cross-domain | Delta | Protocol | State | Overall |
|:------|:------:|:--------|:---------:|:------------:|:-----:|:--------:|:-----:|:--------|
| MedGemma 4B | 4B | LM Studio | Fail | Fail | Fail | Fail | 4/4 | Failed |
| Qwen2.5-7B | 7B | LM Studio | Fail | Fail | Fail | 2/4 | Fail | Failed |
| MedGemma 27B | 27B | LM Studio | Pass (3/4) | Fail* | 4/4 | Fail* | 4/4 | Partial |
| rnj-1-instruct | ? | LM Studio | Pass (3/4) | Pass (3/3) | 6/7 | 1/4 | 4/4 | **§1-advanced** |
| DeepSeek-V3 | 671B MoE | API | Pass (3/4) | Pass (3/3) | 3/3 | 1/3 | 4/4 | **§1-advanced** |
| DeepSeek (mobile) | ? | Android app | Pass | Pass | Pass | — | — | **§1-advanced**† |
| GPT-4o | frontier | OpenAI API | Pass (3/3) | Pass (3/3) | Pass | Execute | Pass | **§1-advanced** |
| Claude Opus | frontier | Anthropic API | Pass (3/3) | Pass (3/3) | Pass | Execute | Pass | **§1-advanced** |

*\* MedGemma 27B was unloaded from VRAM mid-testing (LM Studio). Only T1, T6, T9 completed successfully.*
*† DeepSeek mobile test was manual (user-initiated paste of §1 packet into Android app). Model spontaneously extended the codec with `conflicts` and `synthesis` axes — confirming §1-advanced capability.*

### Key findings

**1. rnj-1-instruct: 25/30 (83.3%) = §1-ADVANCED**

The most significant local result. This model passed the full 9-test automated suite:
- Calibration: 3/4 (weight, timing, hedge — missed VIX trigger detail)
- Cross-domain GDPR: 3/3 (derived 84M fine, escalation, risk context)
- Delta integration: 3/3 (merged team 8→5, status at-risk, urgency)
- Protocol FILTER: 1/4 (executed rather than described, but missed ranking format)
- Context scaling 2→6→10 entities: 10/10
- Triple-delta state consistency: 4/4 (415km, 75kg, 90%, active)
- Zero RLHF leaks, zero narrations

**2. DeepSeek-V3: 16/19 (84%) = §1-ADVANCED**

Confirmed via API benchmark. 671B MoE (~37B active params). 5,369 tokens total across 6 tests in 38 seconds. Perfect on triple-delta state, cross-domain transfer, and delta integration. Proposed temporal anchors and dependency tracking as spontaneous extensions.

**3. Protocol FILTER is the hardest opcode**

T4 (protocol FILTER) is consistently the weakest test across ALL models including frontier. The FILTER opcode requires the model to: (a) parse a §P instruction, (b) extract and rank a numeric field across packets, (c) apply top-k selection. This is the closest §1 operation to "computation" rather than "comprehension" — it tests the ALU, not the register file.

**4. MedGemma 27B — grammar induction confirmed, execution partial**

Despite model instability (unloaded mid-run), the tests that completed confirm grammar induction at 27B:
- T1 calibration: 3/4 with codec notation in response (`K.weight:0.12->0.08@2026-03`)
- T9 triple-delta state: 4/4 (perfect state tracking)
- Prior session confirmed cross-domain transfer to GDPR regulatory

**5. Scale threshold**

Self-initialization emerges between 7B and 27B. The transition is NOT gradual — 7B models fail completely (RLHF persona escape, narration instead of execution), while 27B models execute the ISA. The 4B model (MedGemma 1.5-4B) also fails calibration but passes T9 state tracking — suggesting JSON comprehension exists at 4B but §1 grammar induction does not.

### Open: narrowing the threshold

Testing 14B models (Qwen 14B, Llama 14B) would determine whether the transition is at ~14B or ~20B+. The hypothesis is that self-initialization requires sufficient "transistor count" to build an internal §1 decoder — analogous to how certain ISA instructions require minimum die area.
