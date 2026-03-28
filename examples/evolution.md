# Example: Mid-Conversation Evolution

Adding new axes to a live §1 session without reboot.

---

## Starting state

Assume the model has been booted and is operating on this context:

```json
{"§":1,
 "E":{"H":["hypothesis-A","abstract"],"X":["experiment-12","process"]},
 "S":{"H.claim":"transformer ICL implements gradient descent",
      "H.status":"partially-confirmed",
      "X.n":1200,"X.method":"synthetic-regression"},
 "R":["X→H:tests"],
 "Δ":["H.status:proposed→partially-confirmed@2026-02"],
 "μ":{"scope":"research","urg":0.3,"cert":0.7}}
```

---

## Evolution 1: Add provenance axis (`ρ`)

```
§1|EVOLVE

EX_EVO:
{"§":1,"E":{"H":["hypothesis-A","abstract"]},
 "ρ":{"source":"Garg et al. 2022","peer-reviewed":true,"n":1200,"replication":"partial"}}
= "ρ axis tracks information provenance: source, review status, sample size, replication status."
```

**After this single example, the model can:**
- Read `ρ` on any subsequent packet
- Generate `ρ` when asked to annotate context with provenance
- Reason about provenance (e.g., "filter to peer-reviewed sources only")

---

## Evolution 2: Add confidence decay axis (`τ`)

```
§1|EVOLVE

EX_EVO:
{"§":1,"E":{"H":["hypothesis-A","abstract"]},
 "τ":{"half_life":"30d","floor":0.4,"last_refresh":"2026-02-15"}}
= "τ axis models confidence decay over time: half_life = period to halve certainty, floor = minimum certainty, last_refresh = when data was last validated."
```

**After this single example, the model can:**
- Compute effective certainty: `cert_effective = max(floor, cert * (0.5 ^ (days_elapsed / half_life_days)))`
- Flag packets whose confidence has decayed below a threshold
- Suggest refresh actions for stale packets

---

## Evolution 3: Add priority override axis (`π`)

```
§1|EVOLVE

EX_EVO:
{"§":1,"E":{"T":["task-urgent","task"]},
 "π":{"rank":1,"reason":"deadline 2026-03-30","override":true}}
= "π axis provides priority override: rank (1=highest), reason, and whether it overrides μ.urg sorting."
```

---

## Using evolved axes together

All three new axes compose naturally with the base §1 structure:

```json
{"§":1,
 "E":{"H":["hypothesis-A","abstract"],
      "X":["experiment-12","process"],
      "R_new":["replication-study","process"]},
 "S":{"H.claim":"transformer ICL implements gradient descent",
      "H.status":"partially-confirmed",
      "R_new.status":"in-progress","R_new.n":5000},
 "R":["X→H:tests","R_new→H:replicates"],
 "Δ":["R_new.status:planned→in-progress@2026-03"],
 "μ":{"scope":"research","urg":0.4,"cert":0.7},
 "ρ":{"source":"internal","peer-reviewed":false,"n":5000},
 "τ":{"half_life":"60d","floor":0.3,"last_refresh":"2026-03-15"},
 "π":{"rank":2,"reason":"supports grant deadline","override":false}}
```

The model reads this packet seamlessly — base axes (`E`, `S`, `R`, `Δ`, `μ`) plus all three evolved axes (`ρ`, `τ`, `π`) — because each was introduced with a single example that the model generalized from.

---

## Key properties

1. **One example per axis.** The model induces the new axis from a single `(codec, gloss)` pair.
2. **No schema update.** The §1 version number doesn't change. New axes are additive.
3. **No reboot.** The boot seed stays in context. Evolution happens on top of it.
4. **Axes compose.** New axes don't interfere with base axes or with each other.
5. **Axes are first-class.** Once evolved, they can be used in `§P` protocols — e.g., `{"§P":"filter","by":"π.rank","order":"asc"}`.
