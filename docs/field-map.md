# Where Trasgo Fits: Context Compression Landscape 2024-2026

## The five paradigms

The LLM context compression field has organized around five technical paradigms. Trasgo occupies a distinct position outside all five.

### 1. Hard prompt pruning

**What:** Remove tokens from the prompt before sending to the model.
**Tools:** LLMLingua (Microsoft), Selective Context, LongLLMLingua.
**Mechanism:** Perplexity-based token importance scoring; drop low-information tokens.
**Limitation:** Lossy, unidirectional, destroys structure. Compression is applied to the model — the model is passive.

### 2. Soft prompt learning

**What:** Train continuous prompt embeddings that encode context compactly.
**Tools:** AutoCompressor, Gisting, ICAE.
**Mechanism:** Learned soft tokens replace verbose context in embedding space.
**Limitation:** Requires training. Model-specific (soft tokens don't transfer across models). Not interpretable.

### 3. KV-cache compression

**What:** Compress the key-value cache at inference time.
**Tools:** H2O, ScissorHands, SnapKV, CacheBlend, transform coding approaches.
**Mechanism:** Prune, quantize, or compress cached attention states.
**Limitation:** Infrastructure-level optimization. Invisible to the user. Model- and runtime-specific.

### 4. Information-theoretic coding

**What:** Apply classical coding theory to token sequences.
**Tools:** Arithmetic coding for LLMs, entropy-based approaches.
**Mechanism:** Encode token sequences at their information-theoretic minimum.
**Limitation:** Requires custom tokenizer integration. Not a prompt-level technique.

### 5. Summarization

**What:** Use an LLM to summarize context before passing it to the next LLM call.
**Tools:** LangChain summarize chains, LlamaIndex response synthesizers, recursive summarization.
**Mechanism:** Generate a shorter version that preserves "key information."
**Limitation:** Lossy, subjective, non-invertible. What's "key" depends on downstream task (unknowable at compression time).

---

## Trasgo: representational re-encoding

Trasgo doesn't fit any of the five paradigms because it operates on a different axis entirely.

| Property | Pruning | Soft prompts | KV-cache | Coding | Summarization | **Trasgo** |
|:---------|:--------|:-------------|:---------|:-------|:--------------|:-----------|
| Operates at | Prompt | Embedding | Inference | Token | Prompt | **Prompt** |
| Training required | No | Yes | Varies | No | No | **No** |
| Model-specific | No | Yes | Yes | Yes | No | **No** |
| Lossy? | Yes | No* | Yes | No | Yes | **No** |
| Invertible? | No | N/A | N/A | Yes | No | **Yes** |
| Interpretable? | Partially | No | No | No | Yes | **Yes** |
| Model is... | Passive recipient | Trained on compressed form | Unaware | Unaware | Active compressor | **Active co-compiler** |

\*Soft prompt methods are theoretically lossless but fidelity depends on training quality.

The critical distinction: in every other paradigm, compression happens **to** the model or **outside** the model. In Trasgo, the model **is** the compression engine — it inductively learns the codec from examples and operates natively in compressed form.

---

## What Trasgo gives up

- **Automation.** Pruning and KV-cache methods are fully automatic. Trasgo requires someone to design the codec packet (though this can be LLM-assisted).
- **Byte-level optimality.** Information-theoretic methods achieve near-optimal bit rates. Trasgo operates at the semantic level and makes no claims about bit-level efficiency.
- **Training-time optimization.** Soft prompt methods amortize the cost of compression into training. Trasgo pays at inference time (the 3-example seed costs ~100 tokens).

## What Trasgo gains

- **Zero dependencies.** It's a markdown file, not a library.
- **Cross-model portability.** Same seed works on Claude, GPT-4, Gemini, Llama 70B+.
- **Interpretability.** The compressed form is readable JSON. A human can inspect, edit, and debug codec packets.
- **Evolvability.** New axes mid-conversation with one example. No retraining, no schema migration.
- **Composability.** The hyperprotocol layer (§P + §M) enables routing, multi-agent coordination, and pipeline composition — none of which are possible with token-pruning or KV-cache methods.

---

## Research gaps Trasgo addresses

From the 2024-2026 field survey, three gaps were identified that no existing tool addresses:

1. **Wavelet/multi-resolution context decomposition.** Trasgo's `μ.res` axis and hierarchical codec structure directly implement this.
2. **Geometric/manifold approaches to context.** Trasgo's theoretical foundation (fiber bundles, base/fiber decomposition) connects compression to differential geometry.
3. **Generative context expansion.** Instead of pruning information, Trasgo stores compact generators that expand to full context. This inverts the compression direction.

---

## Complementary, not competitive

Trasgo can compose with existing methods:

- **Trasgo + LLMLingua:** Compress the natural language gloss (after decompression) for models with limited context.
- **Trasgo + KV-cache methods:** The compact §1 representation produces fewer KV entries, amplifying cache compression.
- **Trasgo + summarization:** Use an LLM to generate §1 packets from verbose context (the "compiler" pass), then operate on packets.

The layers are orthogonal. Trasgo operates at the representational level; the others operate at token, embedding, or cache levels.
