# Example: Multi-Agent Mesh

Three agents in a fan-in topology, communicating exclusively via §1-Δ packets.

---

## Mesh definition

```json
{"§M":"mesh",
 "id":"portfolio-review",
 "agents":[
   {"§M":"agent","id":"market",
    "role":"market analyst",
    "boot":"§1|BOOT",
    "budget":2000,
    "output":"§1-Δ"},
   {"§M":"agent","id":"legal",
    "role":"employment law analyst",
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
   {"from":"legal","to":"synth","type":"§1-Δ"}
 ],
 "topology":"fan-in"}
```

---

## Input packet (broadcast to market + legal)

```json
{"§":1,
 "E":{"J":["SrEngMgr","person","Madrid"],
      "V":["Volvo","employer"],
      "P":["portfolio","financial"],
      "S_hearing":["SMAC","legal-proc"]},
 "S":{"J.salary":"85-120k€","J.tenure":"3y",
      "V.status":"dismissed","V.reason":"restructuring",
      "P.value":"45k€","P.exposure":"tech-heavy",
      "S_hearing.date":"2026-03-30","S_hearing.claim":"unfair-dismissal"},
 "R":["V→J:dismissed","J→S_hearing:plaintiff","J→P:owner"],
 "Δ":["V.status:employed→dismissed@2026-02",
      "P.value:52k→45k@2026-03"],
 "μ":{"scope":"multi","urg":0.8,"cert":0.85}}
```

---

## Market agent output (§1-Δ)

```json
{"§":1,
 "source":"agent:market",
 "Δ":["P.risk:moderate→high@2026-03",
      "P.action:rebalance-to-defensive@recommended",
      "P.hedge:increase-cash-to-30%@recommended"],
 "μ":{"scope":"portfolio","urg":0.7,"cert":0.75},
 "rationale":"tech-heavy + income-gap from dismissal = liquidity risk"}
```

---

## Legal agent output (§1-Δ)

```json
{"§":1,
 "source":"agent:legal",
 "Δ":["S_hearing.outcome:favorable@predicted",
      "S_hearing.compensation:6-12mo-salary@estimated",
      "J.action:gather-performance-reviews@recommended"],
 "μ":{"scope":"legal","urg":0.9,"cert":0.6},
 "rationale":"Spanish labor law favors employee in restructuring dismissals with 3y tenure"}
```

---

## Synthesizer receives both Δ packets

The synth agent merges the two streams:

```json
{"§P":"merge",
 "sources":["agent:market.Δ","agent:legal.Δ"],
 "conflict":"flag-for-review",
 "emit":"unified"}
```

---

## Synthesizer output (§1-full)

```json
{"§":1,
 "E":{"J":["SrEngMgr","person","Madrid"],
      "V":["Volvo","employer"],
      "P":["portfolio","financial"],
      "S_hearing":["SMAC","legal-proc"]},
 "S":{"J.salary":"85-120k€","J.status":"between-roles",
      "V.status":"dismissed",
      "P.value":"45k€","P.risk":"high",
      "S_hearing.date":"2026-03-30","S_hearing.prognosis":"favorable"},
 "R":["V→J:dismissed","J→S_hearing:plaintiff","J→P:owner",
      "S_hearing→P:potential-inflow","P.risk→J.status:compounds"],
 "Δ":["P.action:rebalance-to-defensive@recommended",
      "P.hedge:increase-cash-to-30%@recommended",
      "S_hearing.compensation:6-12mo-salary@estimated",
      "J.action:gather-performance-reviews@recommended"],
 "μ":{"scope":"integrated","urg":0.85,"cert":0.7},
 "conflicts":[],
 "synthesis":"Portfolio rebalancing is urgent due to income gap. SMAC hearing is favorable — potential compensation offsets medium-term. Immediate actions: (1) shift portfolio defensive, (2) prepare performance documentation for hearing."}
```

---

## Key observations

1. **All inter-agent communication is §1.** No natural language passes between agents — only structured codec packets.
2. **The synthesizer merges mechanically.** The `§P merge` protocol handles delta union; the synth adds cross-domain relations and an integrated assessment.
3. **Budget is enforced per agent.** Market gets 2000 tokens, legal 1500, synth 3000. The codec's compression means these budgets go much further than natural language.
4. **Conflicts are explicit.** The merge protocol flags conflicting deltas for review instead of silently resolving them.
