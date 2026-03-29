# Example: Single-Domain Session (Energy Grid)

A complete session walkthrough: boot → calibrate → context load → query → delta update.

Demonstrates cross-domain transfer — the energy domain is **not** in the boot seed.

---

## 1. Boot (paste `src/boot.md` seed phase)

The model reads 3 examples across climate, finance, and earth-observation domains.
Grammar induction happens silently during the forward pass.

## 2. Calibrate (on a novel domain)

```
§1|CALIBRATE

CONTEXT:
{"§":1,
 "E":{"W":["NordWind-IV","wind-farm"],"G":["DE-grid-north","grid-segment"],"B":["LiStore-200","battery"]},
 "S":{"W.capacity":"180MW","W.output":"112MW","W.cf":"0.62","G.demand":"340MW","B.charge":"78%","B.max":"200MWh"},
 "R":["W→G:feeds","B→G:stabilizes","B↔W:stores-surplus"],
 "Δ":["W.output:145→112@2026-03","B.charge:92→78@2026-03"],
 "μ":{"scope":"energy","urg":0.5,"cert":0.9}}

Q_codec:   What changed for W and what's the grid impact?
Q_natural: What happened to the wind farm output and how is storage compensating?
```

**Expected answer (either form):**
NordWind-IV output dropped from 145MW to 112MW in March 2026 (capacity factor 0.62). Battery storage (LiStore-200) discharged from 92% to 78% to compensate. Grid demand of 340MW means the segment needs ~228MW from other sources. Storage is stabilizing but depleting.

## 3. Operating — Load full context

```
§1|CONTEXT
{"§":1,
 "E":{"W":["NordWind-IV","wind-farm"],
      "P":["SolarPark-Elbe","solar-farm"],
      "G":["DE-grid-north","grid-segment"],
      "B":["LiStore-200","battery"],
      "T":["NordLink","interconnector"],
      "F":["gas-peaker-7","fossil-backup"]},
 "S":{"W.capacity":"180MW","W.output":"112MW","W.cf":"0.62",
      "P.capacity":"95MW","P.output":"68MW","P.cf":"0.72",
      "G.demand":"340MW","G.renewable-share":"0.53",
      "B.charge":"78%","B.max":"200MWh","B.rte":"0.87",
      "T.capacity":"50MW","T.flow":"import-42MW",
      "F.status":"standby","F.ramp":"15min","F.cost":"89EUR/MWh"},
 "R":["W→G:feeds","P→G:feeds","B→G:stabilizes","B↔W:stores-surplus",
      "T→G:imports","F→G:backup","W↔P:complementary"],
 "Δ":["W.output:145→112@2026-03","P.output:42→68@2026-03",
      "B.charge:92→78@2026-03","G.renewable-share:0.55→0.53@2026-03"],
 "μ":{"scope":"energy","urg":0.5,"cert":0.85}}
```

~130 tokens encoding 6 entities, 16 state variables, 7 relations, 4 deltas, and meta.
Natural language equivalent: ~620 tokens. **Compression: 4.8x.**

## 4. Query

```
Q: Given the renewable share decline, what's the optimal dispatch strategy for the next 6 hours? |out:dual
```

**Expected §1 response:**
```json
{"§":1,
 "E":{"B":["LiStore-200","battery"],"F":["gas-peaker-7","fossil-backup"],"T":["NordLink","interconnector"]},
 "R":["B→G:priority-dispatch","T→G:supplement","F→G:last-resort"],
 "Δ":["G.renewable-share:0.53→target-0.55@+6h"],
 "μ":{"scope":"energy","urg":0.6,"cert":0.75}}
```

**Expected natural language gloss:**
With renewable share at 53% (down from 55%), priority should be: (1) Maximize battery dispatch — 78% charge at 0.87 round-trip efficiency gives ~136MWh available. (2) Maintain NordLink import at 42MW. (3) Keep gas peaker on standby unless battery drops below 30% or wind output declines further. The complementary relationship between wind and solar (W↔P) means evening wind pickup may offset solar decline, improving the renewable share toward 55% without fossil activation.

## 5. Delta update

```
§1|Δ-UPDATE
{"§":1,
 "Δ":["W.output:112→155@2026-03-28T18:00",
      "P.output:68→12@2026-03-28T18:00",
      "B.charge:78→45@2026-03-28T18:00",
      "F.status:standby→active@2026-03-28T17:30"],
 "μ":{"scope":"energy","urg":0.7,"cert":0.8}}
```

The model integrates this delta with existing state. Wind picks up at sunset while solar drops — confirming the complementary relationship. Battery discharged significantly. Gas peaker was activated at 17:30 (30 min before wind recovered). Next query operates on the merged state automatically.

---

## Key observations

This session demonstrates:

1. **Cross-domain transfer** — Energy grid was not in the boot seed. The model induced the grammar from climate/finance/earth-observation examples and applied it to a novel domain.

2. **Multi-entity reasoning** — 6 entities with typed relations. The model tracks flows (feeds, stabilizes, imports, backup) and uses them for dispatch optimization.

3. **Delta integration** — The Δ-UPDATE merges cleanly with prior state. No resend. The model's merged state reflects all changes and their implications.

4. **Complementary inference** — The `W↔P:complementary` relation lets the model predict evening wind recovery offsets solar decline — reasoning over the relation graph, not just individual states.

5. **Compression** — Full grid context in ~130 tokens vs ~620 in natural language (4.8x), with zero information loss on the query-relevant dimensions.
