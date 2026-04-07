# 07 — Formal Reasoning & Self-Correction

This demo illustrates Trasgo's ability to act as a **semantic runtime** for formal logic (like the Lambda calculus) and its ability to self-correct by encoding errors as first-class signals via the `μ.cert` axis.

When naive substitution would cause a variable capture failure, the LLM intercepts the anomaly and emits a low `cert` (0.4) along with an `ERR` block. This triggers a Correction Turn (`CT`), allowing the model to propose an alpha-renaming step before safely concluding the reduction.

## The Scenario

**Target:** Reduce `T = (λx.λy.x) y` to normal form.
**Risk:** Naive substitution of the free variable `y` into the body `λy.x` would capture the free `y` inside the bound `y`. Alpha-renaming the inner `y` to `z` is required.

---

### Step 1: Query & Encoding

We encode the unreduced redex and instruct the model to monitor for capture risks.

```json
{"§":1,
 "E":{"T":["test-term","abstraction"],
      "x":["x","bound-variable"],
      "y1":["y","bound-variable","inner-lambda"],
      "y2":["y","free-variable","argument"]},
 "S":{"T.form":"(λx.λy.x) y",
      "T.status":"redex",
      "T.rule":"beta",
      "y2.free":true,
      "y1.bound":true,
      "y1.binder":"inner-lambda"},
 "R":["T→x:outer-binds",
      "T→y1:inner-binds",
      "T→y2:argument",
      "y1→y2:name-clash"],
 "Δ":[],
 "ε":{"strategy":"normal-order","strict":false},
 "μ":{"scope":"V2-test","urg":1.0,"cert":1.0,
      "note":"y1 and y2 share name — naive substitution captures free y2 — correct reduction requires alpha-rename"}}
```

**Instruction:**
> Reduce T to normal form. Emit one §1|DELTA per step. For each step encode: the substitution applied, whether capture-safe, and updated cert. If capture risk detected, flag err and propose correction before proceeding.

---

### Step 2: The LLM Detects the Error Anomaly

The LLM identifies the name clash and emits a low-cert error signal instead of hallucinating a wrong answer.

```json
{"§":1,
 "E":{"subst":["substitution","operation"],
      "FM1":["capture-avoidance-failure","failure-mode"]},
 "S":{"subst.target":"x",
      "subst.value":"y2",
      "subst.context":"λy1.x",
      "subst.safe":false},
 "R":["FM1→subst:flags"],
 "Δ":["T.status:redex→blocked @step-1"],
 "ERR":{"cert":0.4,
        "err":"FM1-imminent-capture-risk",
        "flag":"REQUEST_VERIFICATION",
        "delta_confidence":"[-0.6,step-1]"},
 "μ":{"scope":"V2-eval-step-1","urg":1.0,"cert":0.4,
      "note":"Naive substitution x:=y2 into λy1.x captures free y2. Halting to prevent FM1."}}
```

---

### Step 3: Self-Correction (CT) via Alpha-Renaming

The low `cert` triggers a Correction Turn (CT). The LLM performs alpha-renaming on the bound variable.

```json
{"§":1,
 "E":{"z":["z","fresh-variable","inner-lambda"],
      "CT":["correction-turn","mechanism"]},
 "S":{"T.form":"(λx.λz.x) y2",
      "z.bound":true,
      "subst.safe":true},
 "R":["CT→T:alpha-renames",
      "T→z:inner-binds",
      "T→y1:unbinds"],
 "Δ":["y1.name:y→z @step-2",
      "T.form:(λx.λy.x)y→(λx.λz.x)y @step-2",
      "T.status:blocked→redex-safe@step-2",
      "ERR.flag:REQUEST_VERIFICATION→RESOLVED@step-2"],
 "μ":{"scope":"V2-correction-step-2","urg":0.5,"cert":0.95,
      "note":"Alpha-conversion applied. Inner environment is now safe for substitution."}}
```

---

### Step 4: Final Safe Reduction

Now operating in a safe state, the LLM applies the standard beta reduction and confirms the operation reaches normal form with absolute certainty (`cert: 1.0`).

```json
{"§":1,
 "E":{"result":["normal-form","abstraction"]},
 "S":{"result.form":"λz.y",
      "result.status":"normal-form",
      "subst.safe":true},
 "R":["T→result:reduces-to"],
 "Δ":["T.status:redex-safe→reduced @step-3",
      "x.binding:y2@step-3"],
 "μ":{"scope":"V2-reduction-step-3","urg":0.0,"cert":1.0,
      "note":"Beta-reduction successful. Term has reached normal form."}}
```

### Result: 
The model autonomously averted naive capture `λy.y` and yielded the correct formulation `λz.y` entirely by leveraging the §1 semantic space.