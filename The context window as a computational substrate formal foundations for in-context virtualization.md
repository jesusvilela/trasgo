# The context window as a computational substrate: formal foundations for in-context virtualization

**A transformer's context window, when analyzed through circuit complexity, information geometry, and associative memory theory, reveals a precisely characterizable computational substrate.** A single forward pass is provably limited to the complexity class DLOGTIME-uniform TC⁰ (constant-depth threshold circuits), but each autoregressive generation step adds sequential depth — and with polynomially many chain-of-thought steps, the system becomes equivalent to a polynomial-time Turing machine (class **P**). This progression from combinational logic to stored-program computation is the formal backbone of in-context virtualization. The following sections compile the key formal results, organized by the seven theoretical axes relevant to a thesis on treating the context window as a virtual machine.

---

## 1. Information-theoretic capacity: what the context window actually holds

The most important distinction in this area is between **nominal** and **effective** context capacity. Liu et al. (TACL 2024, "Lost in the Middle: How Language Models Use Long Contexts") demonstrated a **U-shaped performance curve**: retrieval accuracy peaks when relevant information sits at the beginning or end of the context, dropping **20–40 percentage points** when it appears in the middle. This holds across both open-source and proprietary models, including those explicitly trained for long contexts.

Paulsen (2025) formalized this gap via the concept of **Maximum Effective Context Window (MECW)**, finding that effective capacity is typically only **60–70%** of the advertised maximum, with performance degradation that is sharp rather than gradual. Earlier architectural evidence aligns: Transformer-XL showed perplexity gains saturating around **~900 tokens**, and dialog models exhibit diminishing returns beyond **5–9 turns**. Hsieh et al. (2024, "Found in the Middle") traced the root cause to an intrinsic **U-shaped attention bias** in which beginning and end tokens receive disproportionate attention regardless of relevance, and proposed a calibration mechanism achieving up to **15 percentage points** improvement.

For the raw information bandwidth of a single forward pass, each position in a width-$d$ transformer carries a $d$-dimensional float vector — at 16-bit precision, roughly **16$d$ bits** per position (e.g., ~65,536 bits for $d = 4096$). However, work on intrinsic dimensionality shows the effective information dimensionality converges to a value substantially below $d$. Anthropic's transformer circuits framework (Elhage et al., 2021) identifies the residual stream as a shared **communication bus** with finite bandwidth: all inter-layer and inter-position information must pass through this additive, linear bottleneck. The **data processing inequality** then upper-bounds the mutual information between input and output by the residual stream's capacity.

Hahn (2020, "Theoretical Limitations of Self-Attention in Neural Sequence Models," TACL 8:156–171) provided foundational formal limitations. His **Depth Reduction Lemma** shows that by fixing a small number of input symbols, each attention head in the first layer depends on only a bounded number $c$ of input positions. Iterating across layers, the output depends on at most a **constant number of positions** — independent of input length — establishing that fixed-architecture transformers cannot track global properties of arbitrarily long inputs. This implies the forward pass cannot compute PARITY or recognize Dyck-2 languages.

No published formal bound on $I(\text{prompt}; \text{output})$ for production LLMs exists. McAllester & Stratos (AISTATS 2020) showed that any distribution-free high-confidence lower bound on mutual information is bounded by $O(\ln N)$ where $N$ is the sample size — a fundamental barrier to empirically measuring what fraction of context information reaches the output.

---

## 2. A single forward pass computes exactly TC⁰

The computational power of a single transformer forward pass has been precisely characterized through a series of progressively tighter results.

Merrill & Sabharwal (TACL 2023, "The Parallelism Tradeoff: Limitations of Log-Precision Transformers") proved the central theorem: **log-precision transformers with softmax attention can be simulated by DLOGTIME-uniform TC⁰ circuits** — constant-depth, polynomial-size circuits with threshold/majority gates and unbounded fan-in. This was strengthened to a logical characterization in their NeurIPS 2023 paper ("A Logic for Expressing Log-Precision Transformers"), showing equivalence with **FO(M)** (first-order logic with majority quantifiers). Chiang (2024, "Transformers in Uniform TC⁰") further tightened this: average-hard attention transformers **without approximation**, and softmax transformers with poly($n$) floating-point precision, are all in DLOGTIME-uniform TC⁰. Chen et al. (EMNLP 2025) extended the result to **RoPE-based architectures** specifically.

The hierarchy of attention variants maps cleanly to circuit classes:

- **Hard attention, fixed depth**: AC⁰ (Hahn 2020; Hao et al. 2022) — cannot compute PARITY
- **Soft/saturated attention, O(log $n$) precision**: DLOGTIME-uniform TC⁰ (Merrill & Sabharwal 2022, 2023)
- **Constant-bit precision (even softer)**: AC⁰ (Li et al. 2024) — a proper subset of TC⁰

Under the standard conjecture TC⁰ ≠ NC¹, this means a single forward pass **cannot** solve Boolean formula evaluation, linear equalities over finite fields, or general context-free grammar membership — all of which require deeper sequential computation.

**Can a single forward pass implement one Turing machine step?** Yes. A single TM step (read tape, update state, move head) is a bounded computation well within TC⁰. But simulating $T$ steps for $T$ growing with input length requires either $T$ transformer layers or $T$ autoregressive decoding steps. Li & Wang (2025, "Constant Bit-size Transformers Are Turing Complete") proved that **SPACE[$s(n)$] exactly characterizes** the expressive power of a constant-bit-size transformer with context window of length $s(n)$, via a Post machine simulation.

---

## 3. Chain-of-thought converts TC⁰ into P

The formal results on chain-of-thought (CoT) as computational augmentation constitute the theoretical backbone for in-context virtualization. Three independent lines of work converge on the same conclusion.

Feng et al. (NeurIPS 2023 Oral, "Towards Revealing the Mystery behind Chain of Thought") proved that **bounded-depth transformers cannot directly solve basic arithmetic** (Theorem 3.1: impossibility under TC⁰ ≠ NC¹), but an autoregressive transformer with **constant hidden size, 4 layers, and 4 heads** can generate correct CoT solutions for arithmetic expressions of any length (Theorem 3.3). Their Theorem 4.7 extends this to the **general class of Dynamic Programming** problems.

Li et al. (2024, "Chain of Thought Empowers Transformers to Solve Inherently Serial Problems") tightened the bound: with constant-bit precision, no-CoT transformers can only solve problems in **AC⁰** (weaker than TC⁰). But with $T$ CoT steps, the system solves any problem solvable by Boolean circuits of size $T$. With polynomial $T$, this captures exactly **P**.

Merrill & Sabharwal (ICLR 2024, "The Expressive Power of Transformers with Chain of Thought") provided the definitive hierarchy:

| CoT steps | Complexity class |
|---|---|
| 0 (no CoT) | TC⁰ |
| O(log $n$) | Marginally beyond TC⁰ |
| Θ($n$) | ⊇ all regular languages |
| poly($n$) | **= P** |

They also established space-time tradeoffs: with $t(n)$ intermediate steps, the upper bound is SPACE($t(n)$) and the lower bound is TIME($t(n)$), tight up to a log factor. Nye et al. (2021, "Show Your Work: Scratchpads for Intermediate Computation") demonstrated this empirically: scratchpads improved multi-digit addition from near-zero to high accuracy by externalizing state that would otherwise need to be maintained purely in activations.

**The key formal insight for in-context virtualization**: the context window without CoT is a combinational circuit (parallel, bounded-depth). With CoT, it becomes a **sequential machine with a read-write memory tape**. The transition from TC⁰ to P is the computational analogue of converting combinational logic into a stored-program computer.

---

## 4. The context window implements a modern Hopfield network

Ramsauer et al. (ICLR 2021, "Hopfield Networks is All You Need") established the foundational equivalence: **the update rule of modern continuous Hopfield networks is identical to transformer attention**. Starting from the energy function $E = -\text{lse}(\beta, X^T\xi) + \frac{1}{2}\xi^T\xi + \beta^{-1}\log N + \frac{1}{2}M^2$ and applying the concave-convex procedure, the update rule is $\xi^{\text{new}} = X \cdot \text{softmax}(\beta X^T\xi)$, which is precisely self-attention with $\beta = 1/\sqrt{d_k}$.

The storage capacity results are striking. Classical Hopfield networks (1982) store ~$0.14d$ patterns — linear in dimension. Krotov & Hopfield (NeurIPS 2016) showed polynomial interaction functions yield super-linear capacity ~$\alpha_a d^{a-1}$. Demircigil et al. (J. Stat. Phys. 2017) proved that exponential interactions achieve **$2^{d/2}$ storage capacity** — exponential in dimension. Ramsauer et al. extended this to continuous states, maintaining exponential capacity. For a typical attention head dimension $d_k = 128$, the theoretical capacity is $2^{64} \approx 1.8 \times 10^{19}$ patterns — vastly exceeding any practical context length.

This means the context window's practical limitations are **not** due to associative memory capacity per se. The bottlenecks are computational cost (quadratic in sequence length), pattern interference when stored patterns are correlated rather than random, and the temperature parameter $\beta = 1/\sqrt{d}$ creating metastable states rather than perfect single-pattern retrieval.

The attention-as-memory mapping is precise. Query vectors correspond to **content-addressable memory search data**, key vectors to **stored memory tags**, value vectors to **associated data**, and softmax weights to **soft match scores**. Unlike binary CAM, attention implements **soft content-addressable retrieval** returning weighted mixtures. Geva et al. (EMNLP 2021) showed FFN layers additionally function as key-value memories, with rows of $W_1$ detecting input patterns and columns of $W_2$ encoding output distributions.

Cabannes, Dohmatob & Bietti (ICLR 2024, "Scaling Laws for Associative Memories") derived precise capacity scaling laws for weight-based associative memories (modeling transformer parameters): **$N \approx d^2$** associations for injective mappings, $N \approx d$ for non-injective mappings, and $N \approx md$ for rank-$m$ matrices, with error scaling as $\sim N/d^2$. Millidge et al. (ICML 2022, "Universal Hopfield Networks") unified all associative memory models into three operations — **similarity, separation, projection** — providing a general energy function that is a Lyapunov function of the dynamics.

---

## 5. Attention geometry constrains computation through kernels and optimal transport

The geometry of attention operates at three levels: kernel structure, Riemannian manifold structure, and optimal transport.

Tsai et al. (EMNLP-IJCNLP 2019) reformulated attention as **kernel smoothing**: softmax attention is a special case using the exponential kernel $\kappa(q,k) = \exp(q^Tk/\sqrt{d})$. Choromanski et al. (ICLR 2021, "Rethinking Attention with Performers") deepened this by showing softmax attention is a **positive-definite kernel** decomposable via random feature maps: $\text{SM}(q,k) \approx \phi(q)^T\phi(k)$. This means attention lives in an infinite-dimensional **Reproducing Kernel Hilbert Space (RKHS)**, with the FAVOR+ random feature map providing a finite-dimensional approximation with provably reduced variance (their Theorem 2: orthogonal random features reduce variance for **any** dimensionality, not just asymptotically).

The Riemannian connection emerges through the softmax output distribution. Recent work (arXiv:2602.15293, 2025) identifies the natural geometry of softmax as a **Bregman (dually flat) geometry**, with dual coordinate systems connected by the Legendre transform of the log-normalizer. The Fisher-Rao metric provides the natural Riemannian structure, with e-geodesics minimizing weighted reverse KL divergences and m-geodesics minimizing forward KL divergences.

The optimal transport connection is made rigorous by Sander, Ablin, Blondel & Peyré (AISTATS 2022, "Sinkformers"): replacing softmax normalization with Sinkhorn normalization produces **doubly stochastic** attention matrices, making self-attention iterations interpretable as a **discretized gradient flow for the Wasserstein metric**. In the infinite-sample limit, Sinkformers operate heat diffusion on the space of probability measures. A separate construction (OpenReview 2024/2025) proves transformers can effectively **solve the optimal transport problem** for arbitrary point sets.

Geshkovski, Letrouit, Polyanskiy & Rigollet (AMS Bulletin 2023–2025, "A Mathematical Theory of Transformers") provide perhaps the most complete geometric picture: tokens evolving through layers form an **interacting particle system on the unit sphere $S^{d-1}$** (layer normalization projects to the sphere). The dynamics follow a **Wasserstein gradient flow** of the interaction energy $E_\beta(x_1,\ldots,x_n) = \sum_{i,j}\exp(\beta x_i \cdot x_j)$. They prove **dynamic metastability**: particles converge to a single cluster asymptotically, but remain trapped near multi-cluster configurations for **exponentially long** time — a result connected to the Otto-Reznikoff framework for slow motion of gradient flows. These metastable states correspond to the intermediate representations the "virtual machine" maintains during computation.

---

## 6. Effective computational dimension is far below embedding dimension

The question of what dimensionality of computation a transformer actually performs is answered by several convergent lines of evidence.

Bhojanapalli et al. (ICML 2020, "Low-Rank Bottleneck in Multi-head Attention Models") proved that under standard scaling ($d_p = d/h$), each attention head's output matrix has rank at most **$d_p = d/h$**. With 32 heads and $d = 4096$, each head computes in an effective **128-dimensional subspace**. When $h > d/n$, heads cannot express arbitrary attention patterns at all. Recent work on dimensional collapse in attention (2025, arXiv:2508.16929) confirms that attention outputs exhibit **pronounced low-rank structure** compared to residual streams and MLP outputs, with attention writing into a strict subspace.

Levine, Wies, Sharir & Shashua (NeurIPS 2020, "Limits to Depth Efficiencies of Self-Attention") connected self-attention expressivity to **tensor network rank**, proving a depth threshold $L_{\text{th}} = \log_3(d_x)$. Below this threshold, each additional layer yields **double-exponential** increases in representable tensor rank. Above it, depth becomes inefficient. This provides a precise relationship between architectural depth and the "computational dimensionality" of the forward pass.

The residual stream's role as a bottleneck forces **superposition** (Elhage et al., Anthropic): at layer 25 of a 50-layer model, there are **100× more computational units** (neurons + attention head outputs) than residual stream dimensions. Features are encoded as near-orthogonal directions, enabling the system to represent far more features than dimensions — but at the cost of interference. Aghajanyan et al. (ACL 2021) showed that fine-tuning RoBERTa in only **~200 randomly projected parameters** reaches 90% of full-parameter performance, confirming the effective parameter manifold has very low intrinsic dimensionality. Work on latent semantic manifolds (2025) validates **universal hourglass intrinsic dimension profiles** across six architectures: intrinsic dimension increases then decreases through layers.

For high-dimensional computation specifically, recent constructive results (arXiv:2504.13558, 2025) prove that even a **single self-attention layer** with small-depth FFN can approximate Hölder continuous functions on $[0,1]^d$ **without the curse of dimensionality**, via the Kolmogorov-Arnold Representation Theorem. The transformer decomposes high-dimensional functions into compositions of univariate functions — demonstrating that single forward passes can in principle handle arbitrarily high-dimensional inputs.

---

## 7. Algorithmic capabilities: from RASP to programmable computers

The algorithmic capabilities of transformers have been characterized with increasing precision through three complementary frameworks.

**RASP** (Weiss, Goldberg & Yahav, ICML 2021, "Thinking Like Transformers") introduced a programming language that maps directly to transformer components: **s-ops** (sequence operators) correspond to the residual stream, **selectors** (Boolean pairwise comparison matrices) correspond to attention patterns, and **aggregate** operations correspond to attention heads. The number of select-aggregate pairs equals the required number of layers; distinct selectors per layer equals required heads. RASP programs exist for histograms, sorting, Dyck-$k$ recognition, and logical inference. Lindner et al. (NeurIPS 2023, "Tracr") built a **compiler** from RASP to concrete transformer weights, demonstrating that RASP programs can be realized as actual GPT-like models.

Zhou et al. (ICLR 2024, "What Algorithms can Transformers Learn?") introduced **RASP-L**, a learnable restriction of RASP for decoder-only models, and formulated the **RASP-Generalization Conjecture**: transformers length-generalize on algorithmic tasks when the true next-token function can be written as a short RASP-L program. By redesigning scratchpad formats to shorten the corresponding RASP-L programs, they achieved strong length generalization on traditionally hard tasks like **parity and decimal addition**.

Giannou et al. (ICML 2023, "Looped Transformers as Programmable Computers") proved the most explicit programmability result: **13 encoder layers** in a loop can emulate a universal computer. Specifically, a looped transformer with **10 layers, 2 heads, and width O(log $n$ + log $N$)** can execute **SUBLEQ** programs (a one-instruction-set computer that is Turing-complete). The input sequence serves as a "punchcard" with instructions and data memory. They demonstrated emulations of calculators, linear algebra libraries, and backpropagation/SGD.

For graph algorithms specifically, Back de Luca & Fountoulakis (2024) proved by construction that looped transformers with extra attention heads can simulate **Dijkstra's algorithm, BFS, DFS, and Kosaraju's SCC algorithm** with width independent of graph size. Liu et al. (ICLR 2023 Oral, "Transformers Learn Shortcuts to Automata") showed that $O(\log T)$-depth solutions always exist for simulating $T$ steps of any finite-state automaton, and $O(1)$-depth solutions exist for automata with **solvable** transformation semigroups (via Krohn-Rhodes theory).

Von Oswald et al. (ICML 2023) showed that transformers learn **mesa-optimization**: a single linear self-attention layer with specific weight matrices implements one step of gradient descent, and multi-layer transformers implement iterative preconditioned gradient descent. This means transformers can learn to **run optimization algorithms within the forward pass**, using context as both program and data.

---

## Conclusion: the context window as a virtual machine with known specifications

The formal results surveyed here converge on a precise characterization of the context window as a computational substrate. Without chain-of-thought, the context window is a **parallel read-only memory** accessed by a constant-depth threshold circuit (TC⁰). The information bandwidth is bounded by the residual stream bottleneck (~$16d$ bits per position, with effective dimensionality substantially lower), and the "lost in the middle" phenomenon means only **60–70%** of nominal capacity is usable, with strong positional bias.

With chain-of-thought, the context window becomes a **read-write memory tape** that converts the bounded-depth parallel circuit into a sequential machine. The complexity class scales from TC⁰ through regular languages (linear CoT) to exactly **P** (polynomial CoT). The RASP/Tracr framework provides a concrete **instruction set architecture**, while looped transformers (Giannou et al.) provide the most explicit realization of a programmable computer with input-encoded instructions.

The memory substrate has **exponential associative capacity** ($2^{d/2}$ patterns per head via the Hopfield equivalence), but practical capacity is limited by pattern correlation and the temperature parameter. Geometrically, the computation operates on a dually flat statistical manifold with tokens evolving as particles on $S^{d-1}$ under Wasserstein gradient flows, with **metastable states** persisting for exponentially long time — precisely the stable intermediate configurations needed for multi-step virtual machine execution.

The tightest open question for in-context virtualization is the **constant-factor efficiency** of TM simulation: Li & Wang (2025) showed that constant-bit-size transformers need only $O(s(n)^c)$ CoT steps per TM step (with $c$ arbitrarily small given enough heads/layers), but the practical gap between theoretical and achieved efficiency remains large. The effective computational dimension is far below the embedding dimension due to the low-rank bottleneck in attention ($d/h$ per head) and superposition in the residual stream, yet this compressed representation suffices for the computations transformers empirically perform — suggesting the virtual machine operates in a naturally compressed state space.