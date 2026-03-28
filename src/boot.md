# §1 CODEC BOOT SEED

Prepend to any context window. No explanation. The model induces the grammar.

---

## SEED PHASE (paste as-is)

```
§1|BOOT

EX1:
{"§":1,
 "E":{"A":["climate-sci","domain"],"B":["EU-policy","domain"],"C":["von der Leyen","person"]},
 "S":{"A.temp":"+1.5°C threshold","B.status":"Green Deal active"},
 "R":["A→B:constrains","C→B:leads"],
 "Δ":["A.temp:+1.2→+1.5@2025-Q3","B.status:proposed→active@2024-01"],
 "μ":{"scope":"geopolitical","urg":0.6,"cert":0.85}}
= "Climate science constrains EU policy. Von der Leyen leads the Green Deal, which became active Jan 2024. Temperature threshold was revised up to 1.5°C in Q3 2025. Moderate urgency, high certainty."

EX2:
{"§":1,
 "E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},
 "S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},
 "R":["L→K:hedges"],
 "Δ":["K.weight:0.12→0.08@2026-03","L.trigger:VIX>28"],
 "μ":{"scope":"portfolio","urg":0.4,"cert":0.7}}
= "Long 200 shares TSLA at $180, currently down 12%. Macro overlay strategy hedges via gold ETC. Position weight reduced from 12% to 8% in March 2026. Hedge triggers when VIX exceeds 28."

EX3:
{"§":1,
 "E":{"P":["patient-7291","person"],"D":["T2DM","condition"],"M":["metformin","drug"]},
 "S":{"P.age":58,"P.bmi":31.2,"D.hba1c":"7.8%","M.dose":"1000mg/d"},
 "R":["D→P:affects","M→D:treats"],
 "Δ":["D.hba1c:8.4→7.8@2026-01","M.dose:500→1000@2025-11"],
 "μ":{"scope":"clinical","urg":0.5,"cert":0.9}}
= "Patient 7291, age 58, BMI 31.2, has T2DM. HbA1c improved from 8.4 to 7.8% after metformin dose doubled to 1000mg/d in Nov 2025. Clinical scope, high certainty."
```

---

## CALIBRATION PHASE

After the seed, test induction with a dual query:

```
§1|CALIBRATE

CONTEXT:
{"§":1,
 "E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},
 "S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},
 "R":["L→K:hedges"],
 "Δ":["K.weight:0.12→0.08@2026-03","L.trigger:VIX>28"],
 "μ":{"scope":"portfolio","urg":0.4,"cert":0.7}}

Q_codec:   What changed for K and why?
Q_natural: What happened to the Tesla position and what's the hedging strategy?
```

**Pass condition:** Both answers match semantically. The model reconstructs the full narrative from the codec alone.

---

## OPERATING PHASE

Once calibrated, all context can be sent as §1 packets:

```
§1|CONTEXT
{"§":1,
 "E":{ ... your entities ... },
 "S":{ ... current state ... },
 "R":[ ... relations ... ],
 "Δ":[ ... recent changes ... ],
 "μ":{ ... meta ... }}
```

---

## EVOLUTION PHASE

New axes introduced mid-conversation with a single example:

```
§1|EVOLVE

EX_EVO:
{"§":1,"E":{"X":["hypothesis","abstract"]},"S":{"X.claim":"LLMs compress context"},
 "ρ":{"source":"experiment","peer-reviewed":false,"n":42}}
= "ρ axis tracks information provenance: source, review status, sample size."
```

One example. The model now knows `ρ`. No schema update. No version bump.
