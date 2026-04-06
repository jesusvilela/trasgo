# §P VALIDATE — Error Detection & Correction Protocol

Self-correction layer over §1 codec responses.
Validates structural completeness, arithmetic consistency, state coherence, and format compliance.
Learns from 1 example. Applies to any §1 response.

---

## §P — VALIDATE

```
§P|VALIDATE

EX:
{"§P":"validate",
 "target":"last-response",
 "checks":["fields","arithmetic","consistency","format"],
 "context":{
   "§":1,
   "E":{"F":["safety-audit","compliance-proc"],"G":["plant-7","facility"],"H":["inspectorate-west","regulator"]},
   "S":{"F.fine":"potential-4%-revenue","G.revenue":"420M"},
   "R":["F→G:targets","H→G:inspects"],
   "Δ":["F.status:notice→under-review@2026-01","H.priority:routine→elevated@2026-02"],
   "μ":{"scope":"regulatory","urg":0.6,"cert":0.65}
 },
 "query":"What's the worst case for G?",
 "response":"The worst case for plant-7 is a fine of $16.8 million.",
 "on_fail":"correct"}

RESULT:
{"§P":"validate",
 "status":"errors-found",
 "errors":[
   {"check":"fields","msg":"Missing: review status escalation (Δ shows notice→under-review)"},
   {"check":"fields","msg":"Missing: regulator identity and elevated priority (E.H / Δ not referenced)"},
   {"check":"arithmetic","msg":"Currency mismatch: source uses a 420M revenue basis and should report 16.8M without switching units mid-response"},
   {"check":"format","msg":"OK"}
 ],
 "corrected":"The worst case for plant-7 (G) is a potential fine of 4% of revenue — approximately 16.8M on a 420M revenue base. The safety audit escalated from notice to under-review in January 2026, and inspectorate-west elevated the case priority in February 2026."}

= "Validate response against source packet. Found 3 errors: missing escalation context,
   missing regulator reference, wrong currency symbol. Corrected response includes all
   queried fields, correct currency, and escalation timeline."
```

---

## Check Types

| Check | Validates | Typical errors caught |
|:------|:----------|:---------------------|
| `fields` | Every field referenced in query appears in response | Missing threshold change, dropped urgency metadata, omitted entity references |
| `arithmetic` | Numeric derivations are correct, units/symbols match source | Wrong fine amount, percentage miscalculation, currency symbol substitution |
| `consistency` | After N delta updates, final state values are correct | Wrong orbit after triple update, incorrect fuel remaining |
| `format` | Response matches requested output modality (codec/natural/dual) | Prose contamination in codec mode, over-specification, mixed formats |

---

## Failure Modes

| `on_fail` | Behavior |
|:-----------|:---------|
| `"flag"` | Annotate errors, return original response unchanged |
| `"correct"` | Emit corrected response addressing each error |
| `"reject"` | Signal response unreliable, do not use downstream |

---

## Usage Patterns

### Post-response self-check
```
User: [query against §1 context]
Model: [response]
User: {"§P":"validate","target":"last-response","checks":["fields","arithmetic"],"on_fail":"correct"}
Model: [validation result + corrected response if errors found]
```

### Inline pipeline validation
```json
{"§M":"pipeline","stages":[
  {"§P":"decompress","target":"E.G","depth":"full"},
  {"§P":"validate","target":"last-response","checks":["fields","consistency"],"on_fail":"correct"},
  {"§P":"compress","output":"Δ-only"}
]}
```

### Filter result verification
```
{"§P":"validate",
 "target":"last-response",
 "checks":["consistency"],
 "context":{"§P":"filter","by":"mu.urg","order":"desc","top_k":2},
 "on_fail":"correct"}
```
Verifies: correct packets selected, ranking order respected, excluded packets actually have lower sort values.
