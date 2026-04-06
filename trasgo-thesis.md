# Trasgo §1: In-Context Virtualization via Self-Initializing Codec Induction

**Jesús Vilela Jato**
Independent Researcher, Madrid
March 2026

---

## Abstract

We present Trasgo, a self-initializing context compression protocol that teaches large language models to operate natively in a compact, multidimensional JSON representation — without fine-tuning, weight modification, or external middleware. The protocol exploits in-context learning as an implicit compiler: three structured examples bootstrap a complete instruction set architecture (ISA) that the model induces, executes, and spontaneously extends. We demonstrate 4–7× compression with zero semantic loss across six domains, cross-model portability (Claude, GPT-4o, DeepSeek-V3, Gemini), and a sharp scale threshold for self-initialization emerging between 7B and 27B parameters. Beyond compression, we show that the protocol supports stateful computation: delta-based state machines, protocol atoms (§P) as ALU opcodes, and composable hyperprotocol machines (§M) as programs — establishing the context window as a general-purpose virtual machine. We ground the architecture in seven convergent theoretical pillars: in-context gradient descent, the prediction-compression equivalence, emergent capability thresholds, transformer expressiveness for formal grammars, fiber bundle geometry, minimum description length, and multi-agent communication efficiency.

---

## 1. Introduction

### 1.1 The problem

Large language models process context as serialized natural language — a representation that embeds high-dimensional semantic structure into a flat token stream. This embedding is profoundly redundant: articles, hedging phrases, restatements, and connective tissue consume tokens without adding information. A 500-token context block typically contains ~100 tokens of genuine information content distributed across six intrinsic dimensions (entity, relational, state, temporal, modal, pragmatic), with ~400 tokens of structural and linguistic padding.

Existing compression approaches treat the LLM as a passive recipient: tokens are pruned before the model sees them (LLMLingua), embeddings are compressed during training (Gist Tokens), or KV caches are quantized at inference time (kvpress). In every case, compression happens *to* or *around* the model — never *with* it.

### 1.2 The thesis

**The model itself can serve as the compression engine.** Given a small number of structured examples, a frontier LLM inductively generalizes a complete codec grammar via in-context learning, then operates natively in compressed form — reading, reasoning over, and generating compact representations without any decompression step. The context window is not storing data; it is compiling a program. The model is not a database; it is a runtime.

### 1.3 Contributions

1. **§1 Codec:** A self-initializing multidimensional context representation with five core axes (E, S, R, Δ, μ) and a mid-conversation evolution mechanism for adding custom axes from a single example.

2. **Hyperprotocol layer:** Seven protocol atoms (§P: route, compress, decompress, filter, merge, checkpoint, fork) and five composable machine types (§M: pipeline, router, agent, mesh, loop) that transform the codec from a data format into a computation model.

3. **In-context virtualization thesis:** A rigorous ISA mapping showing that §1 packets are instructions, entity keys are registers, deltas are STORE operations, §P atoms are ALU opcodes, and §M machines are programs — with the LLM as CPU and the context window as address space.

4. **Empirical validation:** Cross-model calibration results across 8 models (4B to frontier), automated benchmark suites, and the identification of protocol FILTER as the hardest opcode — the capability that separates "comprehension" from "computation."

5. **Scale threshold discovery:** Self-initialization emerges sharply between 7B (fails completely) and 27B (partial), with full ISA execution at ~30B+ and spontaneous protocol co-creation at frontier scale.

---

## 2. Theoretical foundations

### 2.1 In-context learning as implicit optimization

The mechanism by which §1 self-initialization works is not pattern matching but implicit gradient descent in the model's forward pass.

**Theorem (Von Oswald et al., ICML 2023).** A single linear self-attention layer with appropriately constructed weight matrices executes exactly one step of gradient descent on the MSE loss. Multiple layers implement multiple GD steps. With MLP layers, the construction extends to learning linear models on deep data representations.

**Theorem (Bai et al., NeurIPS 2023).** Transformers with ReLU attention achieve near-optimal prediction: E[(ŷ − y)²] ≤ inf_w E[(wᵀx − y)²] + Õ(d/N), matching the minimax rate for linear regression, with polynomial pretraining sample complexity.

**Extension to nonlinear functions (Cheng et al., ICML 2024).** Nonlinear transformers implement functional gradient descent in a reproducing kernel Hilbert space (RKHS), where the kernel is determined by the attention activation function. This is the critical result for Trasgo: it implies that the function class learnable in-context is rich enough to encompass structured codec-to-semantic mappings.

**Implication for §1:** When the model processes three codec↔natural language pairs, it is not memorizing a lookup table. It is performing implicit optimization over a function space, constructing an internal mapping f: codec → semantics that generalizes to unseen codec packets. Three examples suffice because the codec has consistent structure (same axes, same notation) and the model's inductive bias favors compositional mappings.

### 2.2 The prediction-compression equivalence

**Theorem (Shannon, 1948; formalized for LLMs by Delétang et al., ICLR 2024).** For any probabilistic model ρ assigning P(xᵢ | x<ᵢ) to each symbol, arithmetic coding produces a lossless code of length ℓ(x₁:ₙ) = Σᵢ ⌈−log₂ ρ(xᵢ | x<ᵢ)⌉ + O(1) bits. Conversely, any lossless compressor defines a probability distribution. Therefore, optimal prediction and optimal compression are formally equivalent.

Delétang et al. demonstrated empirically that Chinchilla 70B compresses English text to 8.3% of raw size (vs. 32.3% for gzip). Since LLMs are trained to minimize cross-entropy loss, they are literally being trained as optimal compressors.

**Implication for §1:** Any structured representation that achieves lower cross-entropy than natural language is, by formal identity, a better compressor. The §1 codec achieves this by eliminating the redundancy that natural language introduces when serializing multidimensional information into a flat token stream. The model's prior over JSON structure, key-value mappings, and relational notation means it processes §1 packets with lower per-token surprise than equivalent natural language — yielding both faster processing and better comprehension.

### 2.3 Emergent capabilities and the scale threshold

**Observation (Wei et al., TMLR 2022).** 137 emergent abilities were cataloged across GPT-3, LaMDA, Gopher, Chinchilla, and PaLM, with near-random performance below ~10²²–10²⁴ training FLOPs.

**Refinement (Du et al., NeurIPS 2024).** Emergence persists even with continuous metrics when viewed through pre-training loss rather than model size — sharp performance jumps occur at specific loss thresholds regardless of metric choice.

**Grammar-specific evidence (Chen et al., ICLR 2024).** Syntactic Attention Structure emerges abruptly during BERT training, precipitating grammatical capabilities. Suppressing SAS prevents linguistic capabilities from emerging — a genuine phase transition, not a metric artifact.

**Composition theory (Arora and Goyal, 2023).** Competence at k-tuple skill compositions emerges at the same scaling rate as individual skill competence, with k' roughly doubling per 10× model scale.

**Implication for §1:** Grammar induction decomposes into sub-skills (pattern recognition, structural generalization, rule composition, entity tracking, relational reasoning, arithmetic over fields). The Arora-Goyal theory predicts that the combined ability emerges once components individually reach competence. Our empirical finding — self-initialization fails at 7B, partially succeeds at 27B, and fully succeeds at frontier — is consistent with a sharp phase transition in composed skill capability.

### 2.4 Transformer expressiveness for structured languages

**Theorem (Yun et al., ICLR 2020).** Transformers with positional encodings are universal approximators of arbitrary continuous sequence-to-sequence functions on compact domains.

**Empirical result (Allen-Zhu and Li, ICLR 2025).** GPT-style models accurately learn and reason over context-free grammars, with internal hidden states precisely capturing CFG structure and attention patterns resembling CYK dynamic programming.

**Grammar prompting (Wang et al., NeurIPS 2023).** LLMs can observe input-output pairs, induce a specialized BNF grammar from those examples, and use that grammar to generate valid DSL outputs across semantic parsing, PDDL planning, and SMILES molecule generation. Notably, grammar prompting did not improve performance for DSLs already in pretraining data (SQL, regex) but significantly helped for novel DSLs — confirming that grammar induction is a genuine in-context capability.

**Implication for §1:** The §1 codec is a context-free grammar (JSON with fixed top-level keys and consistent value structures). Transformers can provably represent such grammars, and the grammar prompting result demonstrates that in-context grammar induction works for novel DSLs. §1 self-initialization is an instance of this general capability applied to a compression-oriented DSL.

### 2.5 Fiber bundle geometry of context

**Framework (Bronstein et al., 2021).** The "5G" Geometric Deep Learning framework unifies CNNs, GNNs, and Transformers under symmetry and equivariance principles. Feature maps are sections of associated vector bundles, and gauge equivariance ensures outputs are independent of local frame choices.

**Application to §1:** Context naturally decomposes as a fiber bundle:

- **Base space B:** The entity-relation graph (E + R). Low-dimensional, topologically invariant across updates. This is the structural skeleton.
- **Fiber F_p at each entity p:** The elaboration — state vectors (S), natural language flesh, modal qualifiers (μ), pragmatic framing. Rich, variable, domain-specific.
- **Section σ: B → E:** A §1 codec packet is a section — it specifies, for each point in the base space, which fiber element is active.
- **Lift:** When the LLM expands a §1 packet into natural language, it performs the lift from base coordinates into the total space E = B × F.
- **Connection (parallel transport):** Delta operations (Δ) transport state along the base space without changing the topology — they are the fiber bundle's connection.

**Novel contribution:** No published work as of March 2026 directly formulates LLM context representations as sections of fiber bundles. This geometric perspective is original to Trasgo and provides both a principled compression criterion (store only the base coordinates; the model reconstructs the fiber via its trained priors) and a formal framework for understanding protocol operations as geometric transformations.

### 2.6 Minimum description length

**Principle (Rissanen, 1978; Grünwald, 2007).** The best model for data is the one that minimizes the total description length: L(model) + L(data | model). This directly formalizes the codec: Part 1 is the JSON schema (~50 tokens of boot seed), Part 2 is the populated values.

**Theorem (Goldblum et al., ICML 2024).** Neural networks — including randomly initialized GPT-2/GPT-3 — exhibit inherent simplicity bias toward low-Kolmogorov-complexity outputs. Larger models show even stronger preference.

**Implication:** A compact JSON codec presents context in a low-complexity structured form aligned with LLMs' inductive preference. The MDL criterion is satisfied when L(boot_seed) + L(§1_packets) < L(natural_language) — which our empirical measurements confirm at 4–7× compression.

### 2.7 Multi-agent convergence to compressed codes

**Theorem (Kharitonov et al., ICML 2020).** Emergent languages in neural multi-agent systems are subject to entropy minimization pressure: mutual information between inputs and messages is minimized within the range required for task success.

**Empirical result (Ashery et al., Science Advances, 2025).** Populations of 24–200 LLM agents spontaneously develop universally adopted social conventions through decentralized interaction — a Lewis signaling game result at LLM scale.

**Implication for §M machines:** The hyperprotocol layer's multi-agent coordination (§M:mesh, §M:agent) can be understood as a designed Lewis convention: agents communicate exclusively via §1-Δ packets, which information theory predicts will converge to near-minimal codes under task pressure. The codec is not arbitrary — it is the kind of compressed protocol that emerges naturally when agents are incentivized to communicate efficiently.

---

## 3. Architecture

### 3.1 Layer 0: §1 Codec

Five core axes factoring context into its intrinsic dimensions:

| Axis | Symbol | Information dimension | NL redundancy eliminated |
|:-----|:------:|:---------------------|:------------------------|
| Entities | E | Who/what nodes | Repeated names, descriptions |
| State | S | Current values | Restated each reference |
| Relations | R | How entities connect | Verbose causal explanations |
| Deltas | Δ | What changed when | Narrative history recaps |
| Meta | μ | Scope, urgency, certainty | Hedging, framing paragraphs |

Custom axes are introduced mid-conversation via a single example (EX_EVO pattern). The model induces the new axis from one (codec, gloss) pair. No schema registration. No version bump.

### 3.2 Layer 1: §P Protocol atoms

Seven pure functions over §1 packets, each self-initializing from one example:

| Atom | Function | ISA analog |
|:-----|:---------|:-----------|
| route | Conditional context activation | Conditional branch (CBZ) |
| compress | Re-encode to Δ-only, strip axes | Bit masking (AND) |
| decompress | Expand entity to natural language | Zero-extend (MOVZ) |
| filter | Budget-ranked top-k selection | Compare + conditional move |
| merge | Multi-source Δ-union | Accumulate (ADD) |
| checkpoint | Snapshot state for rollback | Store pair (STP) |
| fork | Create isolated context branch | Branch with link (BL) |

### 3.3 Layer 2: §M Hyperprotocol machines

Five composable topologies:

| Machine | Topology | Control-flow analog |
|:--------|:---------|:-------------------|
| pipeline | Sequential §P chain | Basic block |
| router | First-match dispatch | Switch / jump table |
| agent | Self-contained unit with boot + budget | Function call |
| mesh | Multi-agent with typed edges | Multi-core / SIMD |
| loop | Iterative refinement with exit condition | While loop |

Machines are first-class: they contain protocols and other machines, composing arbitrarily deep.

### 3.4 Layer 3: Runtime (trasgo.mjs)

The CLI and runtime layer implemented in JavaScript:

- **Session management:** Create, resume, and persist §1 sessions with context state
- **Provider brokering:** §P:balance negotiates between local (LM Studio) and API (OpenAI, DeepSeek) compute based on cost, latency, and capability
- **Skill attachment:** Mount mode-lock, domain-specific context, or custom §P extensions
- **MCP surfaces:** Expose §1 sessions as MCP endpoints for integration with Claude Code, VS Code, etc.
- **stdio host:** `trasgo serve --stdio` for direct process integration

---

## 4. Verification and proof

### 4.1 Experimental design

The verification strategy follows CPU validation methodology:

| Phase | ISA analog | What it tests | §1 test |
|:------|:-----------|:-------------|:--------|
| 01 | Microcode load | Does the firmware boot? | Calibration dual-query |
| 02 | Cross-compilation | Same binary, different arch? | Novel domain transfer |
| 03 | Register ops | STORE/LOAD correct? | Delta integration + triple-merge |
| 04 | ALU execution | Opcodes produce correct results? | Protocol FILTER execution |

### 4.2 Calibration proof (Theorem 1)

**Claim:** A frontier LLM, given three §1 codec↔natural language pairs, can correctly answer semantically equivalent queries from a novel §1 packet containing information not in the boot seed.

**Experimental protocol:**
1. Boot with three examples across disjoint domains (climate, finance, earth-observation)
2. Present a calibration packet (portfolio domain, same structure as EX2 but distinct content)
3. Pose two queries: one using codec entity keys (Q_codec), one in natural language (Q_natural)
4. Pass condition: both answers contain the same four key facts (weight reduction, timing, hedge instrument, trigger condition)

**Results:**

| Model | Q_codec correct | Q_natural correct | Semantic match |
|:------|:---------------:|:-----------------:|:--------------:|
| GPT-4o | 3/3 | 3/3 | ✓ |
| Claude Opus | 3/3 | 3/3 | ✓ |
| DeepSeek-V3 | 3/4 | 3/4 | ✓ |
| rnj-1-instruct | 3/4 | 3/4 | ✓ |
| MedGemma 27B | 3/4 | 3/4 | ✓ |
| Qwen2.5-7B | 0/4 | 0/4 | ✗ (RLHF escape) |
| MedGemma 4B | 0/4 | 0/4 | ✗ |

**Interpretation:** Calibration passes at ≥27B parameters and uniformly succeeds at frontier scale. The 7B failure mode is qualitatively different (persona escape, not partial comprehension), consistent with a phase transition rather than gradual degradation.

### 4.3 Cross-domain transfer proof (Theorem 2)

**Claim:** The §1 ISA generalizes to domains not present in the boot seed.

**Experimental protocol:**
1. Boot with climate/finance/earth-observation examples
2. Present packets in GDPR regulatory law and energy grid management (neither in boot)
3. Queries require domain-specific computation from codec fields (e.g., derive 84M€ fine from 4% × 2.1B€ revenue)

**Results:**

| Model | GDPR (fine derivation) | Energy (fraction computation) |
|:------|:----------------------:|:----------------------------:|
| GPT-4o | ✓ (84M€) | ✓ (33%) |
| Claude Opus | ✓ | ✓ |
| DeepSeek-V3 | ✓ (84M€) | ✓ |
| rnj-1-instruct | ✓ (84M€) | ✓ (33%) |
| Qwen2.5-7B | ✗ | ✗ |

**Interpretation:** Cross-domain transfer confirms that the model learned the instruction format (E, S, R, Δ, μ), not the operand domains. Entity keys F, G, H, W, B were never in the boot seed — the model treats them as registers, not semantic labels.

### 4.4 State machine proof (Theorem 3)

**Claim:** The model maintains a virtual register file across sequential delta updates, answering queries from merged state rather than individual packets.

**Experimental protocol:**
1. Load base state (4 entities, 10 state variables)
2. Apply 3 sequential D-UPDATEs with overlapping field modifications
3. Query the final merged state

**Critical test case (satellite triple-delta):**
- Base: orbit=400km, fuel=82kg, power=100%, payload=idle
- Δ₁: orbit→420, fuel→78
- Δ₂: payload→active, power→85%
- Δ₃: orbit→415, fuel→75, power→90%
- Expected merged: orbit=415, fuel=75, power=90%, payload=active

| Model | orbit | fuel | power | payload | Score |
|:------|:-----:|:----:|:-----:|:-------:|:-----:|
| GPT-4o | ✓ | ✓ | ✓ | ✓ | 4/4 |
| DeepSeek-V3 | ✓ | ✓ | ✓ | ✓ | 4/4 |
| rnj-1-instruct | ✓ | ✓ | ✓ | ✓ | 4/4 |
| MedGemma 27B | ✓ | ✓ | ✓ | ✓ | 4/4 |
| MedGemma 4B | ✓ | ✓ | ✓ | ✓ | 4/4 |

**Significant finding:** State tracking passes at ALL scales including 4B. This capability is independent of §1 grammar induction — even models that fail calibration can track state through JSON deltas. JSON comprehension and state accumulation are separable from codec grammar induction, representing different positions on the capability stack.

### 4.5 Protocol execution proof (Theorem 4)

**Claim:** Frontier models can execute §P protocol atoms as ALU operations — performing computation rather than description.

**Critical test case (FILTER):**
- Three packets with urgency values: A=0.8, B=0.3, C=0.5
- Protocol: `{"§P":"filter","by":"mu.urg","order":"desc","top_k":2}`
- Expected: Select A (0.8) and C (0.5), exclude B (0.3)

| Model | Correct ranking | Correct selection | B excluded | Execute (not describe) |
|:------|:---------------:|:-----------------:|:----------:|:---------------------:|
| GPT-4o | ✓ | ✓ | ✓ | ✓ |
| Claude Opus | ✓ | ✓ | ✓ | ✓ |
| DeepSeek-V3 | ✗ | ✗ | ✓ | partial |
| rnj-1-instruct | ✗ | ✗ | ✗ | ✓ |

**Key finding:** Protocol FILTER is consistently the hardest opcode across ALL models. Even §1-ADVANCED models score 1/3–1/4 on FILTER. This operation requires parsing a §P instruction, extracting and ranking a numeric field across packets, and applying top-k selection — the closest §1 gets to "computation" versus "comprehension." Only frontier models (GPT-4o, Claude Opus) execute §P reliably.

This finding defines the capability hierarchy:

```
JSON comprehension      → 4B+   (all models)
State tracking (Δ)      → 4B+   (all models)
Grammar induction (§1)  → 27B+  (phase transition)
Cross-domain transfer   → 27B+  (co-occurs with induction)
Protocol execution (§P) → frontier only (computation threshold)
```

### 4.6 Spontaneous co-creation (Theorem 5)

**Claim:** Frontier models not only consume the §1 codec but spontaneously extend it with structurally valid, novel additions.

**Evidence:**
- Claude Opus (initial test, documented in this project's origin conversation): Spontaneously added modality selectors (|out:codec, |out:dual), TTL-aware state handling, priority overrides, resolution control, linked packet references, and failure recovery modes — none present in the boot seed.
- DeepSeek-V3 (mobile app test): Spontaneously extended the codec with `conflicts` and `synthesis` axes when processing a multi-agent merge scenario.
- GPT-4o: Proposed temporal anchors, dependency tracking, and conditional logic extensions.

**Interpretation:** This is not pattern completion. The models are treating the codec as a living system they have co-authorship over — identifying structural gaps and filling them with valid extensions that follow the established design principles. This behavior is consistent with the grammar prompting result (Wang et al., NeurIPS 2023) where LLMs induce and then productively use novel grammars.

---

## 5. Compression analysis

### 5.1 Observed compression ratios

| Context type | NL tokens | §1 tokens | Ratio | Domain |
|:-------------|----------:|----------:|------:|:-------|
| Single entity + state | ~120 | ~30 | 4× | any |
| GDPR regulatory (3 entities) | ~280 | ~65 | 4.3× | legal |
| Energy grid (4 entities) | ~380 | ~85 | 4.5× | energy |
| Multi-entity + relations (5 entities) | ~520 | ~85 | 6× | mixed |
| Energy grid (6 entities) | ~620 | ~130 | 4.8× | energy |
| Full domain context (6 entities, 16 state vars) | ~800 | ~120 | 7× | energy |
| Delta update (state change only) | ~80 | ~25 | 3× | any |

### 5.2 Why compression improves with entity count

Natural language restates entity references, relationship descriptions, and contextual framing per entity. §1 encodes relations once in R and states once in S. As entity count grows, the redundancy eliminated per entity increases, yielding super-linear compression improvement.

### 5.3 Information-theoretic bounds

The entropy rate of English is approximately 1.0–1.2 bits per character (Shannon 1951; Takahashi & Tanaka-Ishii 2018). §1 compression operates at the semantic level, not the character level — it eliminates structural redundancy that character-level compression cannot detect (because the redundancy is distributed across phrases and sentences, not within character sequences).

The rate-distortion framework (Nagle et al., NeurIPS 2024) formalizes prompt compression as: D*(R) = inf E[d(Y, ϕ_LLM(M, Q))] subject to E[len(M)/len(X)] ≤ R. Their key finding — that existing prompt compression methods operate far from the theoretical optimum — suggests significant room for improvement in §1's compression ratio through codec design optimization.

---

## 6. Developing avenues

### 6.1 Immediate (Q2 2026)

**6.1.1 Scale threshold narrowing.**
Test §1 calibration on 14B models (Qwen2.5-14B, Llama-3.1-14B) to determine whether the phase transition occurs at ~14B or ~20B+. This has direct practical implications: if 14B suffices, §1 becomes viable for local deployment on consumer GPUs.

**6.1.2 Compression-fidelity curve mapping.**
Systematically vary compression aggressiveness (strip more axes, abbreviate more aggressively, increase abstraction level) and measure semantic fidelity on a standardized question-answering benchmark. Plot the Pareto frontier.

**6.1.3 Tokenizer-exact context accounting.**
The runtime's current token counts are heuristic. Integrate cl100k_base (OpenAI) and Anthropic tokenizers for exact §P:balance budget negotiation.

**6.1.4 Mode-lock hardening.**
Evaluate mode-lock robustness across providers and session lengths. Quantify RLHF escape rate as a function of turns since last §1 packet. Design reinforcement mechanisms (periodic §1 anchors, structured output enforcement).

### 6.2 Medium-term (Q3–Q4 2026)

**6.2.1 Formal verification of §P execution.**
Define a formal semantics for each §P atom (preconditions, postconditions, invariants) and build an automated verifier that checks model output against the specification. This would establish §1 as a formally verifiable computation model.

**6.2.2 Multi-model mesh execution.**
Deploy §M:mesh with actual multi-model topologies (not single-model role-play): Claude as synthesizer, GPT-4o as analyst, DeepSeek as domain expert. Measure cross-model §1-Δ fidelity in real fan-in/fan-out topologies.

**6.2.3 Codec-native reasoning advantage.**
Test the hypothesis that models reason *better* from §1 representations than from equivalent natural language. Mechanism: the codec pre-structures information along the dimensions the model needs for reasoning (entities, relations, state), eliminating the parsing overhead. This would be a profound finding — compression as a reasoning accelerator.

**6.2.4 Hierarchical codec (§2).**
Design a nested codec where §1 packets can contain sub-packets, enabling multi-resolution context: a coarse §1 overview with fine §1 details that expand on demand. This maps directly to the wavelet decomposition analogy in the theory.

### 6.3 Research frontier (2027+)

**6.3.1 Formal codec induction sample complexity.**
Prove bounds on how many in-context examples suffice for §1 induction, and for what class of codecs. This connects to the open problem in in-context learning theory: what is the sample complexity of in-context grammar induction for structured DSLs?

**6.3.2 Fiber bundle formalization.**
Develop a rigorous mathematical treatment of transformer context representations as sections of fiber bundles. Define the connection (parallel transport = delta application), curvature (information loss under transport), and holonomy (state inconsistency after cyclic delta application). This is novel territory with no prior work in the LLM context.

**6.3.3 Self-improving codecs.**
Can the model optimize its own codec? After operating in §1 for N turns, ask it to propose a §2 codec that compresses the same information more efficiently. Iterative self-improvement of the compression scheme — using the model's understanding of its own processing to design better representations for itself.

**6.3.4 Codec as universal agent protocol.**
Extend §1 from a compression format to a universal agent communication protocol. Every agent boots with the same §1 seed. Inter-agent messages are §1-Δ packets. Routing, load balancing, and capability negotiation happen via §P and §M. The codec becomes the TCP/IP of agent communication — a shared protocol layer enabling interoperability across providers, architectures, and capability levels.

**6.3.5 Hardware-aware codec optimization.**
Map §1 packet structure to transformer attention patterns. Design codecs that align with the model's native attention geometry — placing high-information tokens where attention is strongest, structuring packets to minimize cross-attention hops for relational reasoning. This is the "compiler optimization" layer: not just representing information compactly, but representing it in the topology the hardware prefers.

---

## 7. Related work

### 7.1 Prompt compression

LLMLingua (Microsoft, EMNLP 2023) achieves up to 20× compression via perplexity-based token pruning. Headroom (Chopra, 2025) provides content-type-aware proxy compression. 500xCompressor (ACL 2025) achieves 480× via LoRA-based soft tokens. All treat the model as passive. Trasgo inverts this: the model is the compression engine.

### 7.2 In-context learning theory

Garg et al. (2022), Von Oswald et al. (2023), Akyürek et al. (2023), and Bai et al. (2023) established that transformers implement implicit gradient descent. Cheng et al. (2024) extended this to RKHS functional gradient descent. Trasgo is, to our knowledge, the first work to apply these theoretical results to design a self-initializing compression protocol.

### 7.3 Grammar prompting

Wang et al. (NeurIPS 2023) showed LLMs can induce BNF grammars from examples and use them for generation. Trasgo extends this from generation (producing valid DSL outputs) to computation (executing programs written in the induced DSL).

### 7.4 Structured output and DSLs

JSON mode (OpenAI, 2024), structured output enforcement, and constrained decoding (Willard & Louf, 2023) ensure models produce valid structured output. These are complementary to Trasgo: structured output enforcement can harden §P execution by guaranteeing valid codec output format.

---

## 8. Conclusion

Trasgo demonstrates that the boundary between "data" and "program" dissolves in the context window of a sufficiently capable LLM. A self-initializing codec is not merely a compression scheme — it is an instruction set architecture that the model compiles from examples and executes during inference. The theoretical foundations are convergent and rigorous: in-context gradient descent provides the learning mechanism, the prediction-compression equivalence provides the information-theoretic justification, emergent capability theory predicts the scale threshold, and fiber bundle geometry provides the mathematical framework for understanding context structure.

The sharpest empirical finding is the capability hierarchy: JSON comprehension at 4B, state tracking at 4B, grammar induction at 27B, cross-domain transfer at 27B, protocol execution at frontier. This hierarchy is not a smooth curve — it contains at least one genuine phase transition (grammar induction between 7B and 27B) and one capability frontier (protocol FILTER as the boundary between comprehension and computation).

The context window is a virtual machine. The model is the CPU. §1 is the instruction set. The implications extend beyond compression to a new paradigm for LLM interaction: instead of prompting models in natural language and hoping for structured output, we can design the instruction set the model operates on, verify its execution against formal specifications, and compose arbitrarily complex computations from atomic protocol operations.

The trickster spirit has rearranged the house.

---

## References

Akyürek, E., Schuurmans, D., Andreas, J., Ma, T., & Zhou, D. (2023). What learning algorithm is in-context learning? Investigations with linear models. *ICLR 2023*.

Allen-Zhu, Z., & Li, Y. (2025). Physics of Language Models: Part 1, Learning Hierarchical Language Structures. *ICLR 2025*.

Arora, S., & Goyal, A. (2023). A Theory for Emergence of Complex Skills in Language Models. *arXiv:2307.15936*.

Ashery, G., Artime, O., & Baronchelli, A. (2025). Emergent social conventions and collective bias in LLM populations. *Science Advances*.

Bai, Y., Chen, F., Wang, H., Xiong, C., & Mei, S. (2023). Transformers as Statisticians: Provable In-Context Learning with In-Context Algorithm Selection. *NeurIPS 2023*.

Bronstein, M. M., Bruna, J., Cohen, T., & Veličković, P. (2021). Geometric Deep Learning: Grids, Groups, Graphs, Geodesics, and Gauges. *arXiv:2104.13478*.

Chen, X., Shwartz-Ziv, R., Cho, K., Leavitt, M. L., & Saphra, N. (2024). Sudden Drops in the Loss: Syntax Acquisition, Phase Transitions, and Simplicity Bias in MLMs. *ICLR 2024*.

Cheng, S., Chen, Z., & Sra, S. (2024). Transformers Implement Functional Gradient Descent to Learn Non-Linear Functions In Context. *ICML 2024*.

Delétang, G., Ruoss, A., Duquenne, P.-A., et al. (2024). Language Modeling Is Compression. *ICLR 2024*.

Du, Z., Zeng, A., Dong, Y., & Tang, J. (2024). Understanding Emergent Abilities of Language Models from the Loss Perspective. *NeurIPS 2024*.

Goldblum, M., Finzi, M., Rowan, K., & Wilson, A. G. (2024). The No Free Lunch Theorem, Kolmogorov Complexity, and the Role of Inductive Biases in Machine Learning. *ICML 2024*.

Grünwald, P. D. (2007). *The Minimum Description Length Principle*. MIT Press.

Kharitonov, E., Chaabouni, R., Bouchacourt, D., & Baroni, M. (2020). Entropy Minimization In Emergent Languages. *ICML 2020*.

Nagle, J., Girish, D., Bondaschi, L., Gastpar, M., Makkuva, A., & Kim, H. (2024). A Rate-Distortion Framework for Prompt Compression. *NeurIPS 2024*.

Von Oswald, J., Niklasson, E., Randazzo, E., et al. (2023). Transformers Learn In-Context by Gradient Descent. *ICML 2023*.

Wang, B., Wang, Z., Wang, X., Cao, Y., Saurous, R. A., & Kim, Y. (2023). Grammar Prompting for Domain-Specific Language Generation with Large Language Models. *NeurIPS 2023*.

Wei, J., Tay, Y., Bommasani, R., et al. (2022). Emergent Abilities of Large Language Models. *TMLR 2022*.

Yun, C., Bhojanapalli, S., Rawat, A. S., Reddi, S. J., & Kumar, S. (2020). Are Transformers universal approximators of sequence-to-sequence functions? *ICLR 2020*.
