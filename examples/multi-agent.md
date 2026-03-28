# Example: Multi-Agent Mesh

Three agents in a fan-in topology, communicating exclusively via §1-Δ packets.

---

## Mesh definition

```json
{"§M":"mesh",
 "id":"product-launch-review",
 "agents":[
   {"§M":"agent","id":"market",
    "role":"market analyst",
    "boot":"§1|BOOT",
    "budget":2000,
    "output":"§1-Δ"},
   {"§M":"agent","id":"eng",
    "role":"engineering lead",
    "boot":"§1|BOOT",
    "budget":1500,
    "output":"§1-Δ"},
   {"§M":"agent","id":"synth",
    "role":"synthesizer — integrates perspectives, flags conflicts",
    "boot":"§1|BOOT",
    "budget":3000,
    "output":"§1-full"}
 ],
 "edges":[
   {"from":"market","to":"synth","type":"§1-Δ"},
   {"from":"eng","to":"synth","type":"§1-Δ"}
 ],
 "topology":"fan-in"}
```

---

## Input packet (broadcast to market + eng)

```json
{"§":1,
 "E":{"C":["Acme Corp","organization"],
      "P":["product-v2","product"],
      "M":["EU-market","market"],
      "R_reg":["MDR-compliance","regulatory"]},
 "S":{"C.runway":"18mo","C.team":24,
      "P.status":"beta","P.readiness":"72%",
      "M.tam":"340M€","M.growth":"12%/yr",
      "R_reg.status":"pending","R_reg.deadline":"2026-06-30"},
 "R":["C→P:develops","P→M:targets","R_reg→P:gates"],
 "Δ":["P.readiness:55→72%@2026-03",
      "R_reg.status:submitted→pending@2026-02"],
 "μ":{"scope":"multi","urg":0.7,"cert":0.8}}
```

---

## Market agent output (§1-Δ)

```json
{"§":1,
 "source":"agent:market",
 "Δ":["M.window:open→narrowing@2026-Q2",
      "M.competitor:rival-launch@2026-05",
      "P.pricing:premium-viable@validated"],
 "μ":{"scope":"market","urg":0.8,"cert":0.7},
 "rationale":"competitor entering Q2, first-mover premium window closing by June"}
```

---

## Engineering agent output (§1-Δ)

```json
{"§":1,
 "source":"agent:eng",
 "Δ":["P.readiness:72→85%@projected-2026-04",
      "P.blocker:auth-module@critical",
      "C.team:24→22@2026-03"],
 "μ":{"scope":"engineering","urg":0.6,"cert":0.75},
 "rationale":"auth module blocks launch; 2 devs reassigned to compliance work"}
```

---

## Synthesizer receives both Δ packets

The synth agent merges the two streams:

```json
{"§P":"merge",
 "sources":["agent:market.Δ","agent:eng.Δ"],
 "conflict":"flag-for-review",
 "emit":"unified"}
```

---

## Synthesizer output (§1-full)

```json
{"§":1,
 "E":{"C":["Acme Corp","organization"],
      "P":["product-v2","product"],
      "M":["EU-market","market"],
      "R_reg":["MDR-compliance","regulatory"]},
 "S":{"C.runway":"18mo","C.team":22,
      "P.status":"beta","P.readiness":"72%",
      "M.tam":"340M€","M.window":"narrowing",
      "R_reg.status":"pending","R_reg.deadline":"2026-06-30"},
 "R":["C→P:develops","P→M:targets","R_reg→P:gates",
      "M.window→P.timeline:pressures","P.blocker→R_reg:compounds"],
 "Δ":["P.readiness:72→85%@projected-2026-04",
      "P.blocker:auth-module@critical",
      "M.competitor:rival-launch@2026-05",
      "P.pricing:premium-viable@validated"],
 "μ":{"scope":"integrated","urg":0.85,"cert":0.7},
 "conflicts":["M.window narrowing vs P.blocker delays — timeline tension"],
 "synthesis":"Market window closing Q2 due to competitor entry. Engineering projects 85% by April but auth module is critical blocker. Regulatory deadline June 30 compounds timeline pressure. Recommend: (1) prioritize auth module, (2) prepare soft-launch for early adopters, (3) accelerate regulatory submission."}
```

---

## Key observations

1. **All inter-agent communication is §1.** No natural language passes between agents — only structured codec packets.
2. **The synthesizer merges mechanically.** The `§P merge` protocol handles delta union; the synth adds cross-domain relations and an integrated assessment.
3. **Budget is enforced per agent.** Market gets 2000 tokens, engineering 1500, synth 3000. The codec's compression means these budgets go much further than natural language.
4. **Conflicts are explicit.** The merge protocol flags conflicting deltas for review instead of silently resolving them.
