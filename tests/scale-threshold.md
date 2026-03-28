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

| Model | Boot | Calibrate | Cross-domain | Protocol | Co-create | Overall |
|:------|:----:|:---------:|:------------:|:--------:|:---------:|:--------|
| Qwen2.5-7B + LoRA | Narrate | Fail | Fail | Describe | No | Failed |
| Claude Opus (frontier) | Process | Pass (3/3) | Pass (3/3) | Execute | Yes (novel, in §1) | §1-advanced |

*Additional model results pending.*
