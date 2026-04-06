# §P PROTOCOL LAYER + §M MACHINE LAYER

Self-initializing protocol stack over the §1 codec.
Each protocol atom learns from 1 example. Machines compose atoms and other machines.

---

## §P — Protocol Atoms

Nine atomic operations. Each is a pure function over §1 packets.

---

### 1. ROUTE — conditional context activation

```
§P|ROUTE

EX:
{"§P":"route",
 "match":{"μ.scope":"legal"},
 "action":"activate",
 "layers":["contract_law","eu_regulatory","compliance"],
 "suppress":["medical","research"]}
= "Activate legal context layers, suppress irrelevant domains. Match on μ.scope field."
```

---

### 2. COMPRESS — re-encode to compact form

```
§P|COMPRESS

EX:
{"§P":"compress",
 "input":"full",
 "output":"Δ-only",
 "strip":["S"],
 "checkpoint":true}
= "Strip state axis, keep only deltas. Save checkpoint before compressing."
```

---

### 3. DECOMPRESS — expand to natural language

```
§P|DECOMPRESS

EX:
{"§P":"decompress",
 "target":"E.P",
 "depth":"full",
 "format":"natural"}
= "Expand entity P to full natural language description at maximum detail."
```

---

### 4. FILTER — budget-ranked selection

```
§P|FILTER

EX:
{"§P":"filter",
 "by":"μ.urg",
 "order":"desc",
 "top_k":3,
 "budget":500}
= "Select top 3 packets by urgency, within 500 token budget."
```

---

### 5. MERGE — multi-source delta union

```
§P|MERGE

EX:
{"§P":"merge",
 "sources":["agent-1.Δ","agent-2.Δ"],
 "conflict":"latest-wins",
 "emit":"unified-Δ"}
= "Merge deltas from two agents. On conflict, most recent wins. Emit unified delta."
```

---

### 6. CHECKPOINT — snapshot for rollback

```
§P|CHECKPOINT

EX:
{"§P":"checkpoint",
 "id":"cp-001",
 "scope":"all",
 "ttl":"10-turns"}
= "Snapshot all current state. Retain for 10 turns. ID: cp-001."
```

---

### 7. FORK — create isolated context branch

```
§P|FORK

EX:
{"§P":"fork",
 "id":"branch-A",
 "from":"cp-001",
 "inherit":["E","R"],
 "isolate":["S","Δ"]}
= "Branch from checkpoint cp-001. Inherit entities and relations. Isolate state and deltas for independent evolution."
```

---

### 8. VALIDATE — error detection & correction

```
§P|VALIDATE

EX:
{"§P":"validate",
 "target":"last-response",
 "checks":["fields","arithmetic","consistency","format"],
 "context":"source-packet",
 "on_fail":"correct"}
= "Validate last response against source packet. Check: all queried fields present,
   arithmetic derivations correct, state consistent after deltas, output format matches
   requested modality. On failure: emit corrected response."
```

Check types: `fields` (referenced values present), `arithmetic` (numeric derivations correct, units/symbols match), `consistency` (state correct after delta chain), `format` (output matches requested modality). `on_fail`: `"flag"` annotate only, `"correct"` emit fix, `"reject"` signal unreliable. See `src/validate.md` for full spec.

---

### 9. BALANCE — negotiated runtime dispatch

```
§P|BALANCE

EX:
{"§P":"balance",
 "policy":"manifested",
 "targets":["medgemma","deepseek","openai"],
 "mode":"single",
 "fallback":"handoff",
 "persist":"session",
 "priorities":{"protocol":1.1,"locality":0.8,"privacy":0.8,"cost":0.6},
 "constraints":{"require_local":false,"allow_cloud":true}}
= "Negotiate the runtime contract for subsequent turns. Route by manifested capability
   footprints, but keep locality, privacy, and cost in the score."
```

`BALANCE` rewrites the runtime contract. It does not answer the user query directly.

---

## §M — Hyperprotocol Machines

Six composable topologies. Machines contain protocols and other machines.

---

### 1. PIPELINE — sequential protocol chain

```
§M|PIPELINE

EX:
{"§M":"pipeline",
 "id":"ingest-pipe",
 "stages":[
   {"§P":"decompress","target":"*","depth":"summary"},
   {"§P":"route","match":{"μ.scope":"technical"}},
   {"§P":"compress","output":"Δ-only","checkpoint":true},
   {"§P":"filter","by":"μ.urg","top_k":5}
 ]}
= "Decompress all → route to technical scope → compress to deltas with checkpoint → keep top 5 by urgency."
```

---

### 2. ROUTER — first-match dispatch

```
§M|ROUTER

EX:
{"§M":"router",
 "id":"domain-router",
 "rules":[
   {"match":{"μ.scope":"legal"},"pipe":"legal-pipe"},
   {"match":{"μ.scope":"technical"},"pipe":"tech-pipe"},
   {"match":"*","pipe":"general-pipe"}
 ]}
= "Dispatch packets by scope. Legal goes to legal pipeline, technical to tech pipeline, everything else to general."
```

---

### 3. AGENT — self-contained processing unit

```
§M|AGENT

EX:
{"§M":"agent",
 "id":"analyst-1",
 "role":"market analyst",
 "boot":"§1|BOOT",
 "budget":2000,
 "input":"§1-packets",
 "output":"§1-Δ",
 "protocol":{"§M":"pipeline","stages":[
   {"§P":"filter","by":"μ.scope","match":"portfolio"},
   {"§P":"compress","output":"Δ-only"}
 ]}}
= "Self-contained agent: market analyst role, boots with §1 seed, 2000 token budget, receives §1 packets, emits deltas. Internal pipeline filters to portfolio scope then compresses."
```

---

### 4. MESH — multi-agent topology

```
§M|MESH

EX:
{"§M":"mesh",
 "id":"analysis-mesh",
 "agents":[
   {"§M":"agent","id":"market","role":"market analyst"},
   {"§M":"agent","id":"legal","role":"legal analyst"},
   {"§M":"agent","id":"synth","role":"synthesizer"}
 ],
 "edges":[
   {"from":"market","to":"synth","type":"§1-Δ"},
   {"from":"legal","to":"synth","type":"§1-Δ"}
 ],
 "topology":"fan-in"}
= "Three agents in fan-in: market and legal analysts feed deltas to synthesizer."
```

---

### 5. LOOP — iterative refinement

```
§M|LOOP

EX:
{"§M":"loop",
 "id":"refine-loop",
 "body":{"§M":"pipeline","stages":[
   {"§P":"decompress","target":"*","depth":"full"},
   {"§P":"compress","output":"Δ-only"}
 ]},
 "exit":{"μ.cert":">0.95"},
 "max_iter":5}
= "Repeatedly decompress and recompress until certainty exceeds 0.95 or 5 iterations."
```

---

### 6. BROKER — local/API runtime dispatch

```
§M|BROKER

EX:
{"§M":"broker",
 "id":"runtime-broker",
 "contract":{"§P":"balance",
   "policy":"manifested",
   "targets":["lmstudio","deepseek","openai"],
   "mode":"handoff",
   "fallback":"handoff",
   "persist":"session"},
 "observe":["latency","failures","validation"],
 "emit":"route-decision"}
= "Use the session balance contract plus live observations to select the best runtime.
   If the current target underperforms, hand off to the next ranked runtime."
```

The broker is the runtime-facing machine. It consumes seeded capability footprints, refines them from observed session behavior, and routes work across local/API targets without breaking the §1 / §P / §M contract.

---

## Composition

Machines are first-class. A mesh can contain pipelines. A pipeline can contain routers. A loop can contain meshes. A broker can front any of them. It composes all the way down.

```
// Machine containing machines
{"§M":"pipeline","stages":[
  {"§M":"router","rules":[...]},
  {"§M":"loop","body":{"§M":"pipeline","stages":[...]}},
  {"§M":"broker","contract":{"§P":"balance","targets":["local","api"]}},
  {"§P":"checkpoint"}
]}
```

The LLM is the runtime. JSON is the instruction set.

---

## Extension

To add a new protocol or machine, show one example with a gloss:

```
§P|NEW

EX:
{"§P":"summarize","target":"E.*","depth":"one-line","emit":"digest"}
= "Summarize all entities into one-line digest. Emit as new packet."
```

Zero ceremony. The model induces. The protocol evolves.
