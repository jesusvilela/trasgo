# §P PROTOCOL LAYER + §M MACHINE LAYER

Self-initializing protocol stack over the §1 codec.
Each protocol atom learns from 1 example. Machines compose atoms and other machines.

---

## §P — Protocol Atoms

Seven atomic operations. Each is a pure function over §1 packets.

---

### 1. ROUTE — conditional context activation

```
§P|ROUTE

EX:
{"§P":"route",
 "match":{"μ.scope":"legal"},
 "action":"activate",
 "layers":["employment_law","spanish_labor","SMAC_procedure"],
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

## §M — Hyperprotocol Machines

Five composable topologies. Machines contain protocols and other machines.

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

## Composition

Machines are first-class. A mesh can contain pipelines. A pipeline can contain routers. A loop can contain meshes. It composes all the way down.

```
// Machine containing machines
{"§M":"pipeline","stages":[
  {"§M":"router","rules":[...]},
  {"§M":"loop","body":{"§M":"pipeline","stages":[...]}},
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
{"§P":"validate","target":"E.*","check":"referential-integrity","on_fail":"flag"}
= "Validate all entities for referential integrity. Flag failures instead of halting."
```

Zero ceremony. The model induces. The protocol evolves.
