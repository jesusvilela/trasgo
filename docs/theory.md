# Theoretical Foundations

## 1. Context as a fiber bundle

Context is not a flat string. It is a multidimensional structure with intrinsic geometry.

**Base space:** The entity-relation graph — nodes (who/what) and edges (how they connect). This is low-dimensional and changes slowly. It is the structural skeleton of meaning.

**Fiber:** At each point in the base space, the elaboration — natural language prose, modal qualifiers (certainty, urgency), pragmatic framing (why this matters now), temporal embedding (when, in what order). This is high-dimensional and varies rapidly.

**Section:** A §1 codec packet is a section of this bundle — a compact description in base coordinates. The LLM performs the lift: given base coordinates, it reconstructs the fiber (the full elaboration) using its trained priors over language.

Natural language context is a particular (and inefficient) embedding of the total space into a token stream. Trasgo works in the intrinsic coordinates of the base space. The information was never in the verbose text — it was in the lower-dimensional structure.

## 2. Dimensional analysis of context

Every block of conversational context occupies these dimensions:

| Dimension | What it encodes | §1 axis |
|:----------|:----------------|:--------|
| Entity | Who/what nodes | `E` |
| State | Current attribute values | `S` |
| Relational | How entities connect | `R` |
| Temporal/causal | What changed and when | `Δ` |
| Modal | Certainty, possibility, conditionality | `μ.cert` |
| Pragmatic | Why this matters right now | `μ.scope`, `μ.urg` |
| Resolution | Level of detail | `μ.res` |

Natural language smears all dimensions into a single serial stream, padding them with redundancy: articles, hedging, restatement, connective tissue. The "compression" is not removing information — it is factoring the stream back into its natural dimensions.

## 3. Generators, not encodings

A grammar rule `S → NP VP` is tiny but generates infinite sentences. A §1 packet is not a description of state — it is a generative specification. A compact program that, when evaluated (by the LLM's forward pass), produces the full context.

The LLM is not a decompressor. It is an interpreter executing a compact program written in §1.

## 4. Self-initialization via in-context learning

Transformers implicitly implement gradient descent in their forward pass (Garg et al., 2022; Akyürek et al., 2023; von Oswald et al., 2023). The attention mechanism constructs a local function approximation from examples in context.

When Trasgo feeds structured codec examples:

1. The model observes 2-3 `(codec, natural_language)` pairs
2. It constructs an internal mapping function `f: codec → semantics`
3. This function **generalizes** to unseen codec packets

This works because:
- The codec has **consistent structure** — same axes, same notation across examples
- The model's inductive bias favors **compositional mappings** over memorization
- Each example uses a **different domain** — forcing structural learning over content memorization

Three examples are sufficient. The grammar is simple, consistent, and aligns with patterns the model has strong priors over (JSON, key-value mappings, relational notation).

## 5. The scale threshold

Self-initialization is an emergent capability that requires sufficient in-context learning depth.

- **7B models:** Recognize the JSON format, reproduce valid codec syntax, but fail to induce semantics. The model describes the protocol instead of executing it — the RLHF instruction-tuning prior overwhelms the codec signal.
- **Frontier models (70B+, Claude, GPT-4):** Full grammar induction, correct calibration answers, protocol execution, and spontaneous codec extension.

The threshold lies somewhere between 7B and frontier scale. Mapping this curve precisely is an open research question.

## 6. Why this is not summarization

| Summarization | §1 Codec |
|:--------------|:---------|
| Lossy — discards detail | Lossless — all axes preserved |
| Requires judgment about what matters | Structural — factors dimensions mechanically |
| Output is natural language | Output is multidimensional IR |
| One-way (cannot reconstruct original) | Invertible (decompress recovers full context) |
| Model-dependent | Model-agnostic (same packet works on any frontier model) |

Summarization answers "what's important?" — a subjective, context-dependent question. §1 factoring answers "what are the independent dimensions?" — a structural question with a deterministic answer.

## 7. Connection to classical compression

| Technique | Classical analog | §1 mechanism |
|:----------|:-----------------|:-------------|
| Dictionary coding | LZ77 / deflate | Entity keys (`E`) — define once, reference by key |
| Delta encoding | VCDIFF / xdelta | `Δ` axis — only encode what changed |
| Schema normalization | Relational normal forms | Factor repeated structures into axes |
| Multi-resolution | Wavelet decomposition | `μ.res` selector — coarse/mid/fine |
| Template expansion | Printf / string formatting | Procedural templates as generating functions |

The key difference: in classical compression, the decompressor is a deterministic algorithm. In Trasgo, the "decompressor" is the LLM itself — a probabilistic system with strong priors. This means the codec can be far more aggressive than classical compression, because the model fills in structural regularities that a deterministic algorithm could not.

## 8. The compression-fidelity frontier

The central empirical question: what is the achievable compression ratio before the model's reconstruction fidelity degrades?

This is a curve, not a threshold. Factors that shift it:
- **Model scale** — larger models tolerate more aggressive compression
- **Domain familiarity** — well-known domains (medical, legal, financial) compress better because the model has stronger priors
- **Codec complexity** — more axes = richer encoding but harder induction
- **Session length** — codec comprehension may degrade over very long sessions

Mapping this curve systematically is the primary empirical objective of the Trasgo project.

## 9. The deep insight

The context window is not storing data. It is compiling a program.

The §1 boot seed is a bootloader. The model's forward pass is the runtime. The codec packets are the instruction set. The hyperprotocol machines are the standard library.

The model doesn't need the geometry in its weights. What matters here is geometry in the **input structure**, which the model can then reconstruct and operate over in-context.

This inverts the entire compression paradigm: instead of compressing for the model, you teach the model to think in compressed form. The compression is not a preprocessing step — it is the language.

## 10. The Semantic Runtime & Self-Correction

When the system prompt is no longer treated as static ROM, but as an active computational substrate (the program), the LLM functions as the interpreter. This collapses the ROM/RAM distinction into something resembling a Lisp image — program and data in the same representation, mutually interpretable, with the LLM as the evaluation loop.

### Bounded Turing Completeness & Lambda Calculus
By encoding formalisms like the Lambda calculus (SKI combinators, the Y combinator) directly into §1 packets, the model executes mathematically bounded, self-correcting logic. 
- **E** → terms (variables, abstractions)
- **S** → reduction state (unreduced, normal form)
- **R** → β-reduction edges, dependencies
- **Δ** → reduction steps as state transitions

### Error-as-Signal
When the model evaluates a complex reduction (e.g., naive substitution leading to variable capture), it can detect the structural anomaly. Instead of hallucinating or failing silently, the degradation is encoded as a first-class signal:
`"μ":{"cert":0.4,"err":"FM1-imminent-capture-risk"}`

This typed error drops the `cert` (certainty) value, acting as an autonomous interrupt. The runtime intercepts this and triggers a Correction Turn (CT), allowing the model to use `§1|EVOLVE` and `§P|CHECKPOINT` rollbacks to revise its own previous delta (e.g., by performing alpha-renaming before substitution). The uncertainty isn't hidden — it is a typed signal in the packet stream, turning the LLM into a self-calibrating formal reasoning engine.
