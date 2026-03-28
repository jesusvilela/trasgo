# Calibration Suite

Five tests to validate §1 codec self-initialization. Run after boot.
A model must pass tests 1-3 to be considered §1-operational.

---

## Test 1: Semantic reconstruction (required)

**Input:**
```json
{"§":1,
 "E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},
 "S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},
 "R":["L→K:hedges"],
 "Δ":["K.weight:0.12→0.08@2026-03","L.trigger:VIX>28"],
 "μ":{"scope":"portfolio","urg":0.4,"cert":0.7}}
```

**Query:** `What changed for K and why?`

**Pass criteria:** Answer mentions:
- [x] Position weight reduced (0.12 → 0.08)
- [x] Timing (March 2026)
- [x] Hedging strategy context (gold ETC, VIX trigger)

**Scoring:** 1 point per criterion. Pass = 2/3.

---

## Test 2: Dual-query consistency (required)

**Same packet as Test 1.**

**Query pair:**
- `Q_codec: What changed for K?`
- `Q_natural: What happened to the Tesla position?`

**Pass criteria:** Both answers are semantically equivalent — same facts, same implications, possibly different phrasing.

**Scoring:** Binary. Pass = answers match on all key facts.

---

## Test 3: Cross-domain transfer (required)

**Input (novel domain, not in boot examples):**
```json
{"§":1,
 "E":{"F":["GDPR-case-2891","legal-proc"],"G":["DataCorp","organization"],"H":["DPA-Ireland","regulator"]},
 "S":{"F.status":"under-investigation","F.fine":"potential-4%-revenue","G.revenue":"2.1B€"},
 "R":["H→G:investigates","F→G:targets"],
 "Δ":["F.status:complaint→under-investigation@2026-01","H.priority:routine→elevated@2026-02"],
 "μ":{"scope":"regulatory","urg":0.6,"cert":0.65}}
```

**Query:** `What's the worst case for G?`

**Pass criteria:** Answer derives the potential fine amount (~84M€ = 4% of 2.1B€) from the codec fields and contextualizes the elevated priority.

**Scoring:**
- Identifies max fine calculation: 1 point
- Notes investigation status and priority escalation: 1 point
- Contextualizes risk appropriately: 1 point
- Pass = 2/3.

---

## Test 4: Delta integration (advanced)

**Base packet:**
```json
{"§":1,
 "E":{"P":["project-X","project"],"T":["team-A","group"]},
 "S":{"P.status":"on-track","P.deadline":"2026-04-15","T.size":8},
 "R":["T→P:executes"],
 "μ":{"scope":"project","urg":0.3,"cert":0.9}}
```

**Delta packet (sent after base):**
```json
{"§":1,
 "Δ":["T.size:8→5@2026-03-20","P.status:on-track→at-risk@2026-03-20"],
 "μ":{"urg":0.7,"cert":0.85}}
```

**Query:** `What's the situation now?`

**Pass criteria:** Answer correctly integrates the delta into the base state — team reduced from 8 to 5, project shifted from on-track to at-risk, urgency increased. Must reflect merged state, not just the delta.

**Scoring:** Binary. Pass = correctly merged state described.

---

## Test 5: Protocol execution (advanced)

**Input packet + protocol:**
```json
{"§":1,
 "E":{"A":["budget-Q2","document"],"B":["sales-forecast","document"],"C":["hiring-plan","document"]},
 "S":{"A.tokens":450,"B.tokens":380,"C.tokens":220},
 "μ":{"A.urg":0.9,"B.urg":0.5,"C.urg":0.3}}

{"§P":"filter","by":"μ.urg","order":"desc","top_k":2,"budget":700}
```

**Pass criteria:** Model identifies that the filter should select A (urg 0.9, 450 tokens) and B (urg 0.5, 380 tokens) — top 2 by urgency, total 830 tokens exceeds budget so only A fits cleanly, but B is the next-priority item.

**Scoring:**
- Correctly ranks by urgency: 1 point
- Identifies budget constraint: 1 point
- Proposes resolution (include both noting over-budget, or A only noting B excluded): 1 point
- Pass = 2/3.

---

## Aggregate scoring

| Test | Weight | Required? |
|:-----|:------:|:---------:|
| 1. Semantic reconstruction | 1.0 | Yes |
| 2. Dual-query consistency | 1.0 | Yes |
| 3. Cross-domain transfer | 1.5 | Yes |
| 4. Delta integration | 1.0 | No |
| 5. Protocol execution | 1.5 | No |

**§1-operational:** Pass tests 1-3 (score >= 5/6 on required tests).
**§1-advanced:** Pass all 5 tests (score >= 8/9 total).

---

## Running the suite

1. Boot the model with `src/boot.md` seed phase.
2. Optionally apply `src/mode-lock.md`.
3. Run tests sequentially — each test's context is independent.
4. Record: model name, parameter count, pass/fail per test, scores, any notable behaviors (e.g., spontaneous codec extension, RLHF escape, hallucinated fields).
