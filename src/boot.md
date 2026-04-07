# §1 CODEC BOOT SEED

Prepend to any context window. No explanation. The model induces the grammar.

---

## SEED PHASE (paste as-is)

```
§1|BOOT

EX1:
{"§":1,
 "E":{"A":["climate-sci","domain"],"B":["coastal-policy","domain"],"C":["climate-council","institution"]},
 "S":{"A.temp":"+1.5°C threshold","B.status":"adaptation-plan active"},
 "R":["A→B:constrains","C→B:governs"],
 "Δ":["A.temp:+1.2→+1.5@2025-Q3","B.status:draft→active@2024-01"],
 "μ":{"scope":"geopolitical","urg":0.6,"cert":0.85}}
= "Climate science constrains coastal policy. A climate council governs the adaptation plan, which became active in January 2024. Temperature threshold was revised up to 1.5°C in Q3 2025. Moderate urgency, high certainty."

EX2:
{"§":1,
 "E":{"K":["cooling-loop-7","industrial-asset"],"L":["safeguard-policy","control-strategy"]},
 "S":{"K.flow":"4200kg/s","K.state":"nominal","L.action":"derate-load"},
 "R":["L→K:protects"],
 "Δ":["K.state:nominal→derated@2026-03","L.threshold:0.68→0.61@2026-03"],
 "μ":{"scope":"operations","urg":0.4,"cert":0.7}}
= "Cooling loop 7 is operating at 4200 kg/s under nominal conditions. A safeguard policy protects it by derating load when vibration risk rises. The loop moved from nominal to derated in March 2026, and the trigger threshold tightened from 0.68 to 0.61."

EX3:
{"§":1,
 "E":{"V":["Sentinel-6","satellite"],"O":["LEO-1336km","orbit"],"I":["Poseidon-4","altimeter"]},
 "S":{"V.status":"operational","O.incl":"66°","O.period":"112min","I.mode":"SAR","I.coverage":"global-ocean"},
 "R":["V→O:occupies","I→V:payload"],
 "Δ":["I.mode:LRM→SAR@2026-02","V.power:nominal→eco@2026-03"],
 "μ":{"scope":"earth-observation","urg":0.3,"cert":0.95}}
= "Sentinel-6 satellite in LEO at 1336km, 66° inclination, 112-min period. Poseidon-4 altimeter switched from low-res to SAR mode in Feb 2026. Spacecraft power shifted to eco mode in March. Global ocean coverage, low urgency, very high certainty."

EX4:
{"§":1,
 "E":{"op":["substitution","operation"]},
 "S":{"op.safe":false},
 "R":[],
 "Δ":["op.status:attempting→blocked@step-1"],
 "ERR":{"cert":0.4,"err":"FM1-capture-risk","flag":"REQUEST_VERIFICATION",
        "delta_confidence":"[-0.6,step-1]"},
 "μ":{"scope":"error-signal","urg":1.0,"cert":0.4,
      "note":"substitution halted — correction turn required"}}
= "Substitution attempt detected variable capture risk. Operation blocked. Certainty dropped to 0.4. Requesting verification before proceeding."
```

---

## CALIBRATION PHASE

After the seed, test induction with a dual query:

```
§1|CALIBRATE

CONTEXT:
{"§":1,
 "E":{"K":["cooling-loop-7","industrial-asset"],"L":["safeguard-policy","control-strategy"]},
 "S":{"K.flow":"4200kg/s","K.state":"nominal","L.action":"derate-load"},
 "R":["L→K:protects"],
 "Δ":["K.state:nominal→derated@2026-03","L.threshold:0.68→0.61@2026-03"],
 "μ":{"scope":"operations","urg":0.4,"cert":0.7}}

Q_codec:   What changed for K and why?
Q_natural: What happened to cooling loop 7 and what's the safeguard strategy?
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
