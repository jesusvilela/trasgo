# Trasgo Foundations

Trasgo is best understood as a representation shift, not as a prompt-shrinking trick.

Natural-language context is often an overcomplete embedding of a lower-dimensional task state. Trasgo introduces an intrinsic coordinate chart over that state, plus a small executable protocol layer. The objective is not textual reconstruction. The objective is preserving the geometry of the task well enough for reasoning, routing, and action under a bounded attention budget.

## Core claim

Trasgo is a self-initializing intermediate representation for in-context computation.

It is not primarily:

- a JSON trick
- a compression library
- a prompt optimizer

It is an IR that frontier models can induce from exemplars and then operate over as a low-overhead working language for context.

## Informational view

The right unit is not raw token count. The relevant quantity is task-relevant information per unit of effective attention budget.

Verbose natural language wastes context budget through:

- lexical redundancy
- repeated re-anchoring of entities and relations
- weak separation between state and change
- low-salience placement of critical facts

That suggests a different optimization target:

- base state as low-entropy invariant memory
- delta stream as high-information updates
- resolution control as rate-distortion management
- protocol packets as control information distinct from domain payload

In this view, Trasgo is closer to source coding under inference constraints than to summarization. A good codec should maximize recoverable task structure, not textual reconstructability.

## Geometric view

Trasgo can be described with a geometric vocabulary:

- ambient space: token-sequence space
- intrinsic space: task-state or context manifold
- chart: codec packet
- fiber: discourse realization or elaboration layer
- tangent: deltas and perturbations
- section: a chosen expansion into prose, code, legal framing, or operator notes

This yields a useful decomposition:

- base manifold: entities, stable attributes, persistent relations
- tangent bundle: recent changes, events, state transitions, weight shifts
- fiber structure: multiple realizations of the same underlying state
- connection: rules for carrying state across turns without drift
- curvature: where local encodings fail to compose globally

Practical curvature shows up as contradictions, alias collisions, scope failures, or assistant-mode escape back into verbose narration. Compression works when the representation aligns with the intrinsic geometry of the task state better than plain language does.

## Computational view

The context window is not only storage. It is a bounded computational substrate.

A practical model is:

- tokens as addressable memory locations
- attention as content-based routing
- the residual stream as a shared bus
- autoregressive steps as sequential depth
- emitted tokens as externalized working memory

Two regimes matter:

- single-pass pattern machinery: fast, parallel, shallow
- multi-step autoregressive machinery: slower, sequential, capable of richer algorithmic behavior through intermediate state emission

Trasgo helps the second regime by:

- reducing search over noisy prose
- externalizing state in a machine-tractable layout
- separating data packets from control packets

That is the ISA analogy at its strongest: the codec is a program-friendly memory layout for in-context computation.

## Factorized spaces

The context window simultaneously lives in several coupled spaces:

- token space
- embedding space
- attention space
- task-state space
- protocol space
- trajectory space across turns

Natural language entangles these spaces. Trasgo partially factorizes them:

- `E` captures object identity
- `R` captures topology and relation structure
- `Δ` captures dynamics and state transition
- `μ` captures control and meta constraints
- `§P` captures protocol operators
- `§M` captures machine composition

This is why Trasgo differs from prompt compression utilities. It is a factorization of spaces, not merely a shorter serialization.

## Thesis propositions

The thesis can be organized around four propositions:

- `P1.` Verbose context is an inefficient embedding of a lower-dimensional task state.
- `P2.` A codec aligned with the intrinsic factorization of that state improves effective context utilization.
- `P3.` Frontier models can self-initialize such a codec in-context from exemplars.
- `P4.` Once initialized, the codec supports a protocol layer that turns the context window into a more explicit computational substrate.

These are stronger than branding claims and weaker than overconfident theorems. They are intended to be tested.

## Experimental priorities

The highest-value experiments are:

1. Rate-fidelity curve: compression ratio versus downstream task performance.
2. Induction threshold curve: model scale or capability threshold for reliable codec self-initialization.
3. State-tracking versus narration: whether the model operates over packets rather than merely paraphrasing them.
4. Delta integration depth: how many updates can be absorbed before drift or contradiction appears.
5. Protocol execution boundary: which operators remain reliable and where execution degrades.

## Guardrails

Two constraints matter for public materials:

- Use synthetic or public-domain examples only in demos, screenshots, boot seeds, thesis figures, and benchmark fixtures.
- Present geometric and computational language as a framework unless a specific claim has been benchmarked or sourced.

One sentence worth preserving:

The context window is not memory in the ordinary sense; it is a bounded virtual workspace whose power depends as much on representation as on size.
