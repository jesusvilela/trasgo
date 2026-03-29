# Demo 03: Register File — Deltas as State Transitions

> **Concept:** Entity registers hold state. Deltas (D) are STORE instructions that update register contents. The model maintains a **virtual register file** across the conversation — when you query, it reads from the merged register state, not from the original instruction stream.
>
> **ISA analogy:** In ARM64, `STR x1, [x2]` stores the value of x1 at the address in x2. In §1, `"D":["R.status:pre-ignition->plasma-formation"]` stores a new value in register R, field status. The CPU doesn't resend the register file on every instruction — it updates in place. §1 works the same way.
>
> **Scientific basis:** In the fiber bundle formalism, the base space (entity-relation graph) is invariant. The fiber at each entity carries its current state. A delta is a **fiber transport** — it moves the state along the entity without changing the base structure. The model performs the lift.
>
> **Time to reproduce:** ~4 minutes. Requires a booted session.

---

## Setup

Boot with `src/boot.md` (3 examples). Then proceed:

---

## Step 1: Load base state

```
>>>

§1|CONTEXT
{"§":1,
 "E":{"R":["reactor-4","fusion-experiment"],"P":["plasma-ctrl","subsystem"],
      "D":["diagnostics","subsystem"],"T":["ops-team","group"]},
 "S":{"R.status":"pre-ignition","R.target-Q":"10","R.pulse-length":"300s",
      "P.mode":"calibration","P.temp":"target-150MK",
      "D.sensors":"thomson+bolometry","D.rate":"10kHz",
      "T.size":12,"T.shift":"day"},
 "R":["P->R:controls","D->R:monitors","T->R:operates","P<->D:feedback-loop"],
 "mu":{"scope":"fusion-research","urg":0.3,"cert":0.9}}
```

This encodes a fusion experiment: reactor, plasma control, diagnostics, operations team. ~70 tokens.

The equivalent in natural language: "Reactor 4 is a fusion experiment in pre-ignition phase targeting Q=10 with 300-second pulse length. The plasma control subsystem is in calibration mode targeting 150 million Kelvin. Diagnostics uses Thomson scattering and bolometry at 10kHz sampling rate. A 12-person operations team is on day shift. Plasma control and diagnostics operate in a feedback loop." (~85 tokens)

**Query the base state:**

```
>>>

What's the current readiness status?
```

The model should describe all four entities and their states coherently.

---

## Step 2: Apply first delta

```
>>>

§1|D-UPDATE
{"§":1,
 "D":["P.mode:calibration->active@2026-03-28T09:00",
      "R.status:pre-ignition->plasma-formation@2026-03-28T09:15",
      "D.rate:10kHz->50kHz@2026-03-28T09:00"],
 "mu":{"urg":0.6,"cert":0.85}}
```

Three things changed: plasma control went active, reactor entered plasma formation, diagnostics sampling rate increased 5x.

**Query the merged state:**

```
>>>

What just happened and what should the team watch for?
```

### Expected result

The model should:
- Describe the transition from calibration to active plasma formation
- Note the diagnostics rate increase (10kHz to 50kHz — higher temporal resolution for the critical phase)
- Reason about the feedback loop (P<->D) — diagnostics data now feeds back into plasma control at higher bandwidth
- Urgency increased from 0.3 to 0.6

**Key test:** The model's answer must reflect the **merged** state — reactor in plasma-formation (not pre-ignition), plasma control active (not calibration), diagnostics at 50kHz (not 10kHz). If it correctly merges, it's maintaining a virtual state register.

---

## Step 3: Apply second delta (escalation)

```
>>>

§1|D-UPDATE
{"§":1,
 "D":["R.status:plasma-formation->sustained-burn@2026-03-28T09:45",
      "P.temp:target-150MK->measured-148MK@2026-03-28T09:45",
      "R.Q-measured:0->5.2@2026-03-28T09:45",
      "T.size:12->18@2026-03-28T09:30"],
 "mu":{"urg":0.8,"cert":0.75}}

How close are we to the target and what are the risks?
```

### Expected result

The model should now reason over **triple-merged** state:
- Reactor progressed: pre-ignition → plasma-formation → sustained-burn
- Q measured at 5.2 vs target of 10 (52% of target — model should compute this)
- Temperature at 148MK vs 150MK target (98.7% — near target)
- Team expanded from 12 to 18 (more personnel for critical phase)
- Certainty dropped to 0.75 — the situation is less predictable
- Risk: sustained burn with Q < target means the plasma might not self-heat sufficiently

---

## What this demonstrates

```
State evolution over 3 steps:

t0: Base state          (4 entities, 10 state vars)
t1: D-UPDATE #1         (+3 transitions, urg 0.3->0.6)
t2: D-UPDATE #2         (+4 transitions, urg 0.6->0.8, cert 0.9->0.75)

Total context sent: ~70 + ~30 + ~35 = ~135 tokens
Equivalent NL resend: ~85 * 3 = ~255 tokens (but actually more, since state grows)
```

The model maintained a coherent state register across three phases without receiving the full context again. Each delta was a **state transition** — the model applied it to its internal representation and answered from the merged result.

This is **in-context virtualization**: the context window is a register file. STORE (delta) updates register contents. LOAD (query) reads from merged state. No full-state resend needed.

---

## Failure mode: register overflow

If the model "forgets" earlier state (e.g., reports team size as 12 instead of 18, or reactor status as plasma-formation instead of sustained-burn), the register file has **overflowed** — the model ran out of effective context to track all state.

This happens when:
- **Context saturation** — Too many entities × state fields × deltas exceed the model's effective attention budget (like running out of physical registers)
- **Delta chain depth** — Too many sequential updates without checkpointing (like stack overflow without frame cleanup)
- **Weak multi-hop** — The model can't trace: delta #2 applied to result of delta #1 applied to base state (like a pipeline stall)

The §P `checkpoint` protocol (Demo 04) addresses this — it's the equivalent of **register spilling** to memory: snapshot the merged state so future deltas apply to a clean base.
