# §1 Codec Grammar Reference

> **Human-only document.** This is a reference for developers and researchers.
> Never paste this into a model's context window — the model should induce the grammar from examples, not read a specification.

---

## Packet structure

Every §1 packet is a JSON object with these reserved top-level keys:

```json
{
  "§": 1,          // codec version (required)
  "E": { ... },    // entities
  "S": { ... },    // state
  "R": [ ... ],    // relations
  "Δ": [ ... ],    // deltas
  "μ": { ... }     // meta
}
```

All axes except `§` are optional. A valid packet can contain any subset.

---

## Axis specifications

### `§` — Version (required)

Integer. Currently `1`. Signals to the model that this is a §1 codec packet.

### `E` — Entities

```json
"E": {
  "key": ["label", "type"],
  "key": ["label", "type", "qualifier"]
}
```

- **key:** Short identifier (1-3 chars recommended). Used in all other axes.
- **label:** Human-readable name.
- **type:** Category — `person`, `domain`, `equity`, `condition`, `drug`, `strategy`, `organization`, etc.
- **qualifier** (optional): Additional disambiguator.

### `S` — State

```json
"S": {
  "key.attribute": "value",
  "key.attribute": 42
}
```

Dot notation: `entity_key.attribute_name`. Values can be strings, numbers, arrays, or nested objects.

### `R` — Relations

```json
"R": [
  "A→B:relation_type",
  "C↔D:bidirectional_type"
]
```

- `→` directed edge
- `↔` bidirectional edge
- Relation types are free-form: `constrains`, `leads`, `hedges`, `treats`, `affects`, `dismissed`, etc.

### `Δ` — Deltas

```json
"Δ": [
  "key.attribute:old_value→new_value@timestamp",
  "key.status:state1→state2@YYYY-MM"
]
```

Format: `entity.attribute:from→to@when`

- `@timestamp` uses ISO-ish dates: `2026-03`, `2025-Q3`, `2026-01-15`
- Deltas are ordered chronologically within the array.

### `μ` — Meta

```json
"μ": {
  "scope": "domain_label",
  "urg": 0.0-1.0,
  "cert": 0.0-1.0,
  "res": "coarse|mid|fine",
  "ttl": "N-turns"
}
```

- **scope:** Domain tag for routing (`legal`, `technical`, `clinical`, `portfolio`, etc.)
- **urg:** Urgency weight (0 = background, 1 = critical)
- **cert:** Certainty level (0 = speculative, 1 = confirmed)
- **res:** Resolution selector for multi-level detail
- **ttl:** Time-to-live — how many turns before this packet should be re-evaluated

All μ fields are optional.

---

## Custom axes

New axes can be introduced at any time via the evolution protocol. Common extensions:

| Axis | Purpose | Example |
|:-----|:--------|:--------|
| `ρ` | Provenance | `"ρ":{"source":"experiment","peer-reviewed":false}` |
| `τ` | Confidence decay | `"τ":{"half_life":"5-turns","floor":0.3}` |
| `π` | Priority override | `"π":{"rank":1,"reason":"deadline"}` |
| `λ` | Linked packets | `"λ":["pkt-003","pkt-007"]` |

Custom axes follow the same rules: short key, JSON value, introduced with one example.

---

## Control signals

### Boot

```
§1|BOOT
```

Initiates the seed phase. Followed by 2-3 `EX:` blocks with codec + natural language pairs.

### Calibrate

```
§1|CALIBRATE
```

Tests grammar induction. Provides a codec packet and dual queries (codec + natural language).

### Evolve

```
§1|EVOLVE
```

Introduces a new axis via one example.

### Mode lock

```
§1|MODE lock:codec
§1|MODE unlock
```

Enters/exits sustained codec operation mode.

### Output modality

```
|out:codec
|out:natural
|out:dual
```

Appended to queries to control response format.

---

## Protocol and machine signals

See `src/hyperprotocol.md` for the `§P` and `§M` layers.

Protocols use: `{"§P": "protocol_name", ...}`
Machines use: `{"§M": "machine_name", ...}`

Both are JSON objects that follow the same structural conventions as §1 packets.

---

## Design constraints

1. **No prose in packets.** Packets are structured data, not natural language with JSON formatting.
2. **Keys are short.** Entity keys: 1-3 chars. Axis keys: 1 char (Greek or Latin).
3. **Relations are strings.** The `→`/`↔` notation is compact and unambiguous.
4. **Deltas encode transitions.** Always `from→to@when`, never just the new value.
5. **Meta is numeric where possible.** `urg: 0.8` not `urg: "high"`.
6. **Packets are self-contained.** Every packet includes enough context to be interpreted without prior packets (though deltas reference prior state implicitly).
