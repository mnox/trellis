# Trellis

**A taxonomy-driven code planning system that gets better the more you use it.**

Trellis guides growth — the taxonomy is the structure, and labeled training data accumulates along it as a natural byproduct of normal development work. At the core is **LORE** (Labeled Observation and Retrieval Engine): a passive signal ingestion layer that captures architectural intent every time an LLM agent produces code.

---

## The thesis

The frontier model API paradigm is not the endgame. Routing every code generation request through a massive general-purpose model — paying per token, accepting the latency, and hoping the model generalizes well to your specific stack — is a transitional state, not a destination.

The direction the industry is heading is toward **specialized micro models and hybrid architectures**: smaller, faster, cheaper models that are deeply tuned to a specific domain, stack, or task. Open source models that a team can own, fine-tune, and run on their own infrastructure. Hybrid systems where a small specialized model handles the common 80% of cases and routes the hard 20% to a larger model only when needed.

This is already happening. The evidence is in every "small model beats big model on narrow task" benchmark that drops every few months. The bottleneck isn't capability — it's training data. Specifically: **high-quality, structured, task-specific training data that captures what good looks like in your exact context**.

Trellis is a stepping stone in that direction.

The goal isn't to replace frontier models today. The goal is to start accumulating the signal now — structured, labeled, stack-aware — so that when the fine-tuning tooling, the open source base models, and the hybrid routing infrastructure mature to the point where a specialized code planning model is practical to build and run, the training data is already there. Dense, validated, and organized by architectural intent.

The taxonomy and three-signal data model are deliberately generic and agnostic. Not because the system lacks opinions, but because the research is still moving fast. Emergent findings about what makes fine-tuned code models work well, what reward signals matter most, and what architectural abstractions generalize across stacks — these will shape what the training data needs to look like. The data model is designed to pivot with those findings without starting over: add taxonomy nodes, re-label with a new schema version, weight signals differently. The tap stays on through the iteration.

The bet is simple: **whoever has the best-structured data when specialized models become practical wins**. Trellis is how you start accumulating it today.

---

## What this is

Every time an LLM generates code, Trellis simultaneously labels that code with structured taxonomy paths describing the architectural patterns it demonstrates — things like `data|read|paginated`, `ui|form|submission`, `auth|guard|query`. These labels, along with the original intent, the stack context, and typed edges between co-occurring patterns, are stored as training records via LORE. Human corrections and failed solutions are captured in separate tables, each feeding a distinct reward signal. The whole thing runs passively — no explicit training workflow, no interruption to normal development.

Over time this builds a dense, structured dataset organized by architectural intent rather than by syntax or library surface area. That distinction matters. Taxonomy-keyed data describes *what* code is doing architecturally — the pattern — not *how* a specific framework exposes it. That level of abstraction is what makes the data reusable across model architectures, training approaches, and stack generations.

The core taxonomy is stack-agnostic by design. `data|read|realtime` is the same architectural concept whether the implementation uses Convex, Supabase, or Apollo. The stack lives as metadata on each record — not in the taxonomy path — so the same signal accumulates regardless of which technologies are in play, and retrieval can be stack-filtered without the underlying data being stack-fragmented.

### How this data plugs into future training layers

The records LORE accumulates are structured to be useful across multiple training and inference paradigms — not just the retrieval layer Trellis is building toward:

**Supervised fine-tuning (SFT).** Every `solutions` record is a labeled `(intent, code, taxonomy_paths)` triple. Filtered by stack, confidence, and durability score, these become high-quality SFT examples for a code generation model. The taxonomy paths become the structured output target; the intent becomes the input. The `corrections` table provides a clean source of preference pairs — original labeling vs. human-corrected labeling — directly usable for alignment.

**Reinforcement learning from human feedback (RLHF / RLAIF).** The three reward signals map naturally onto reward model training. Correction rate measures how often a labeling was wrong (negative reward signal). Compilation pass rate measures whether the code actually works (outcome reward). Human rejections in the `negatives` table are explicit negative examples. The separation of these signals into distinct tables means they can be weighted independently rather than collapsing into a single noisy score.

**Retrieval-augmented generation (RAG).** The most immediate use: at inference time, retrieve the highest-durability examples matching the inferred taxonomy path set and inject them as few-shot context. This works with any base model — no fine-tuning required. The taxonomy key is the retrieval index; the stack filter narrows to relevant examples. This is Phase 3 of the Trellis roadmap, and the data structure is already built for it.

**Taxonomy-conditioned generation.** As specialized models mature, the taxonomy paths can become explicit conditioning signals — the model is trained to take `(intent, taxonomy_paths[])` as structured input and produce code that satisfies those constraints. LORE data is already structured this way. The transition from "RAG with taxonomy keys" to "model conditioned on taxonomy" becomes a fine-tuning step, not a data restructuring effort.

**Distillation targets.** The `model` field on every record tracks which model produced the code. Opus-generated solutions weighted highest, Haiku lowest. This makes the dataset usable as distillation training data — teaching a smaller specialized model to produce the quality of output that a larger model would, for the patterns that matter in your stack.

---

## Current state (MVP — v0.1.0)

The MVP is the data tap. LORE is running. The tap is on.

### What's built

**Taxonomy** (`taxonomy/index.ts`)
- 60 nodes across 8 architectural domains
- 3-level path format: `L1|L2|L3`
- 14 typed edge types encoding relationships between co-occurring patterns
- LLM-legible descriptions and examples per node — prompting context for the labeling agent, not machine logic
- Schema version `1.1.0` — add new nodes without retraining

**MCP server** (Convex HTTP + JSON-RPC 2.0)

Three tools the agent calls during development:

| Tool | Purpose | Reward signal |
|------|---------|--------------|
| `ingest_solution` | Working code + taxonomy labels | Taxonomy coverage |
| `ingest_correction` | Human override of labels | Intent parsing accuracy |
| `ingest_negative` | Failed/rejected code + failure mode | Edge validity |

**Convex storage** (`convex/schema.ts`)

Three ingestion tables, one per reward signal — intentionally never merged:
- `solutions` — labeled code with stack context, model, confidence, and file paths
- `corrections` — human overrides linked to the original solution
- `negatives` — failed solutions with failure mode classification and file paths

Three graph tables — generic, fully dynamic:
- `nodes` — risks, patterns, facets, and any future node type. Keyed by slug, typed by an open string.
- `node_edges` — typed topology between nodes (e.g. `prompt-injection --has_facet--> security`)
- `record_nodes` — links solutions/negatives to nodes with edge type and confidence

### Taxonomy domains

```
ui       — components, forms, feedback, navigation, layout
routing  — segments, layouts, errors, loading, guards
data     — schema, reads (basic/filtered/paginated/realtime/search), writes, jobs
server   — actions, handlers, middleware
auth     — providers, identity, session, guards, webhooks
state    — client state, URL state, optimistic state
styling  — layout utilities, variants, theming, animation
types    — validators, shared types/props
```

### Three reward signals (kept separate by design)

```
solutions   → taxonomy coverage       (which patterns exist, how often)
corrections → intent parsing accuracy (what the code actually meant)
negatives   → edge validity           (which pattern combinations don't work)
```

These signals feed different dimensions of the training loop. Merging them would destroy the separation.

---

## Long-term vision

### Phase 1 — LORE: the data tap (current)
Passive accumulation of labeled training data. Every code generation session produces structured records. Human corrections and failures are captured automatically. The system enriches itself through use without any explicit training workflow.

The goal of this phase is simple: turn the tap on and leave it running. Volume and variety of signal matters more than perfection at this stage. The correction flywheel handles noise — a mislabeled solution isn't a problem, it's a future training signal waiting to be resolved.

### Phase 2 — Durability & decay scoring
Not all training data ages equally. A working solution from 18 months ago may be stale if the underlying library changed its API. A pattern that gets corrected repeatedly is less reliable than one that's never been challenged. Phase 2 introduces a scoring system that continuously re-evaluates the quality and freshness of accumulated records.

The schema already carries the fields (`durabilityScore`, `compilationPassed`, `correctionCount`) — no migration required. Phase 2 is purely additive: a scoring function that populates those fields based on observed signals.

Scoring dimensions:
- **Coverage** — how many validated examples exist for this pattern combination?
- **Correction rate** — how frequently has this labeling been overridden? High correction rate = lower confidence in the original label
- **Compilation & test pass rate** — does the code actually run and pass tests? Outcome-verified solutions are weighted significantly higher
- **Recency** — newer solutions outweigh older ones for fast-moving stacks; decay rate is configurable per stack
- **Model provenance** — Opus-generated solutions weighted higher than Haiku; stronger source model = higher prior confidence

A key insight here: durability scoring creates a natural curriculum. As the corpus grows, low-durability records fade in influence while high-durability records rise. The system automatically surfaces its most reliable signal over time without manual curation.

### Phase 3 — Retrieval layer
The retrieval layer is where accumulated data starts actively improving generation. At inference time: infer the taxonomy path set for an incoming intent, retrieve the highest-durability matching examples from the corpus, and inject them as structured context before generation begins.

Two-stage retrieval:
1. **Taxonomy key lookup** — exact match on path combination, stack-filtered. Fast, precise, zero semantic drift.
2. **Embedding similarity** — within the matched bucket, rank by semantic similarity between the incoming intent and stored intents. Surfaces the most relevant examples when multiple solutions exist for the same path set.

Graceful degradation is a first-class property. When the corpus is sparse for a given path combination, the system falls back cleanly to the base model — no retrieval, no injected context, standard generation. As density increases, retrieval starts contributing. The transition is smooth and automatic. The system is never worse than the base model; it only gets better.

This phase also introduces **cross-stack signal transfer**: because taxonomy paths are stack-agnostic, a well-represented pattern in the Rails corpus can inform generation for the same pattern in a sparse NextJS corpus. The abstract pattern `data|write|transactional` looks structurally similar across stacks even when the syntax differs. Retrieval can surface cross-stack examples with a clear stack label, letting the model generalize the pattern while adapting the implementation.

### Phase 4 — Recursive satisfaction evaluator
A configurable generation loop modeled loosely on the Vercel AI SDK's `maxSteps` pattern. Rather than generating once and returning, the evaluator iterates until a satisfaction threshold is met or `maxIterations` is reached.

Each iteration:
1. Generate a candidate solution, label it with taxonomy paths
2. Retrieve the best matching exemplars from the corpus
3. Score the candidate against those exemplars across multiple dimensions: structural similarity, edge coverage, stack-appropriateness, and an optional external signal (compilation, tests)
4. If score exceeds threshold — return the solution and ingest it as a positive
5. If score is below threshold — ingest the candidate as a negative with the specific failure mode, refine the prompt with that feedback, and iterate

The `maxIterations` dial is an explicit cost/quality tradeoff. Set it to 1 and you get standard single-pass generation. Set it higher and the system invests in self-correction. The key property: **every failed iteration is automatically a training record**. The evaluator produces training data as a byproduct of doing its job. The more it runs, the better the exemplar set it evaluates against, which makes future iterations more accurate. This is the core of the self-improving loop.

### Phase 5 — Compositional planning
The name "Trellis" is forward-looking. Phases 1–4 improve code *generation*. Phase 5 is about code *planning*: given a complex multi-component feature, decompose it into a valid composition of taxonomy paths, verify the edges between them are structurally sound, and generate each component in dependency order with full awareness of how the pieces connect.

This is what "compositional" means. Not just labeling a single file, but understanding that a feature like "authenticated real-time dashboard with optimistic updates" decomposes into a specific graph of taxonomy nodes with specific edge types between them — and that graph can be validated, reused, and refined independently of any specific implementation.

The retrieval layer (Phase 3) makes single-component generation better. The compositional planner makes multi-component *architecture* better. It's the difference between autocomplete and a co-architect.

### Phase 6 — Trellis SDK & the open corpus
Stack-agnostic, open-source SDK. The taxonomy is the stable core. Stack-specific **packs** bundle a curated seed corpus, a tuned taxonomy extension, and optional fine-tuned model weights for a specific domain:

```
@trellis/pack-nextjs-convex    ← NextJS + Shadcn + Convex patterns
@trellis/pack-rails            ← Rails + Hotwire patterns
@trellis/pack-fastapi          ← FastAPI + SQLAlchemy patterns
```

Ship a pack, get LORE for free. Every project using a pack contributes signal back to the corpus (opt-in). As the contributor base grows, the pack gets denser, which improves generation quality for everyone using it. The open source flywheel and the AI training data flywheel are the same flywheel.

A **model registry** layer sits on top: Trellis-compatible fine-tuned models, trained on domain-specific corpus slices, that can be swapped in as the base generator for a given pack. The retrieval layer and the fine-tuned model compound — better base model + better retrieval context = significantly better generation than either alone.

---

## The compounding loop

The architecture is designed around a single property: **every output feeds the next input**.

```
intent
  → generation
    → taxonomy labeling        [LORE: ingest_solution]
      → durability scoring     [Phase 2]
        → retrieval context    [Phase 3]
          → better generation
            → better labeling
              → higher durability scores
                → better retrieval
                  → ...
```

Failed iterations contribute negatives. Human corrections contribute ground truth. Compilation results contribute outcome signal. Every interaction — successful or not — makes the next one more informed. There is no wasted signal.

The cold start is real but bounded. Day one, the retrieval layer has nothing and the system performs at base model quality. By week two of active use, common patterns in your stack are represented. By month two, the corpus is dense enough that retrieval is meaningfully improving generation quality. The compounding rate accelerates as coverage increases — early additions to the corpus have high marginal value; later additions fill in edge cases.

---

## Emergent properties

A few properties of this architecture that aren't obvious from the component descriptions:

**Multi-agent shared corpus.** Multiple Claude Code instances writing to the same LORE deployment naturally build a shared institutional knowledge base. One developer's well-labeled solutions become another's retrieval exemplars. Team-level patterns emerge in the corpus without any explicit coordination — the taxonomy provides the shared vocabulary that makes this work.

**Taxonomy as a living artifact.** Novel paths emitted by agents aren't just gaps to fill — they're signals about how the model perceives architectural space. If agents consistently emit `data|read|hybrid` as a novel path, it suggests a meaningful pattern exists between `realtime` and `paginated` that the current taxonomy doesn't capture. The taxonomy evolves to reflect real usage rather than upfront categorization. The agents help design their own taxonomy over time.

**Adversarial example collection at scale.** The `negatives` table solves one of the hardest data collection problems in ML: negative examples. People don't naturally record their failures. Trellis makes this automatic — every compilation error, test failure, and rejected solution is captured with its full context. At scale, this becomes a dense map of the failure space for each pattern combination, which is exactly what's needed to train a model that knows what *not* to do.

**Stack archaeology.** Because every record carries a schema version and a timestamp, the corpus becomes a historical record of how patterns evolved. When a library releases a breaking change, the durability scoring system flags the affected records. You can query "how did `data|write|basic` look in this stack before vs. after version X" and see the evolution in the training data. The corpus develops a timeline.

---

## Getting started

### Prerequisites
- Node.js 18+
- A [Convex](https://convex.dev) account

### Setup

```bash
npm install
npx convex dev
```

The first `convex dev` run will prompt you to create or link a project, then generate `convex/_generated/`.

### Add to Claude Code

```json
{
  "mcpServers": {
    "trellis": {
      "url": "https://<your-convex-deployment>.convex.site/mcp"
    }
  }
}
```

From this point on, the agent passively ingests labeled solutions, corrections, and negatives as a side effect of normal development work. The tap is on.

### Generate taxonomy JSON

```bash
npx tsx taxonomy/generate-json.ts
```

Exports `taxonomy/nodes.json` — a portable snapshot useful for inspection, versioning, or external tooling.

---

## Architecture

```
trellis/
├── taxonomy/
│   ├── index.ts            ← LORE taxonomy: 60 nodes, 14 edge types, helpers
│   └── generate-json.ts    ← Exports taxonomy/nodes.json
└── convex/
    ├── schema.ts            ← solutions, corrections, negatives, nodes, node_edges, record_nodes
    ├── http.ts              ← HTTP router: /mcp
    ├── solutions.ts         ← Internal mutations
    ├── corrections.ts       ← Internal mutations
    ├── negatives.ts         ← Internal mutations
    ├── nodes.ts             ← Generic node graph (getOrCreate, listByType)
    ├── node_edges.ts        ← Node topology edges (upsert)
    ├── record_nodes.ts      ← Record-to-node links (link, listForRecord)
    └── mcp/
        ├── tools.ts         ← Tool definitions (JSON schema)
        ├── instructions.ts  ← LLM system prompt
        ├── handler.ts       ← JSON-RPC 2.0 handler
        └── actions.ts       ← Actions bridging handler → mutations
```

### Key design decisions

**Taxonomy is generic, stack context is metadata.** `data|read|paginated` collects signal from every stack. Stack specificity (`{ framework, libraries, language }`) lives on the record. Filter by stack at retrieval time; learn the pattern at training time.

**Agent-native labeling.** Node descriptions are LLM-legible prose — prompting context, not validation logic. Novel paths in valid `L1|L2|L3` format are accepted and flagged for taxonomy review. Label noise is corrected by the `ingest_correction` flywheel.

**Convex as the backend.** Reactive queries, built-in full-text search, and HTTP actions make it a natural fit. The MCP server is a Convex HTTP router — no separate process.

**Schema versioning without retraining.** New taxonomy nodes = new entries in `taxonomy/index.ts` + version bump. Old records keep their version tag, enabling filtered re-labeling without touching the model.

---

## Taxonomy path format

All paths are three levels: `L1|L2|L3`

A typical solution maps to 2–6 paths. A form component that reads live data, validates input, submits to a mutation, and shows optimistic feedback:

```
ui|form|schema
ui|form|fields
ui|form|submission
data|read|realtime
data|write|optimistic
types|validator|form
```

With edges:
```
ui|form|submission      →[submit_handler]→      data|write|optimistic
ui|form|schema          →[type_contract]→        ui|form|fields
data|write|optimistic   →[optimistic_binding]→   state|optimistic|update
```

---

## Edge types

| Edge | Meaning |
|------|---------|
| `submit_handler` | Form submission wired to a write |
| `data_binding` | Component reads from a reactive source |
| `optimistic_binding` | Optimistic UI state tied to a pending write |
| `schema_backing` | Read/write backed by a schema definition |
| `auth_guard` | Route, query, or mutation enforces auth |
| `identity_propagation` | Auth identity flows into downstream context |
| `revalidate_after` | Write triggers cache invalidation |
| `webhook_sync` | Inbound webhook triggers a local write |
| `variant_binding` | Component appearance driven by a variant system |
| `url_state_sync` | Component state encoded in URL params |
| `error_boundary` | Error caught and displayed via a UI boundary |
| `loading_state` | Async op wired to a loading/skeleton UI |
| `type_contract` | Validator/type constrains multiple co-occurring paths |
| `job_trigger` | Write or event triggers an async background job |

---

## Roadmap

### Immediate (Phase 1 hardening)
- [ ] Deploy: `npx convex dev` → wire MCP endpoint to Claude Code
- [ ] First real ingestion session — validate taxonomy coverage against actual usage patterns
- [x] Schema v1.1 — graph layer for risk profiling, pattern tracking, and facets
- [ ] Query/export interface — inspect accumulated data by path, stack, model, and confidence
- [ ] Deduplication — detect near-duplicate solutions ingested for the same intent

### Near-term (Phase 2)
- [ ] Durability scoring function — populate `durabilityScore` based on correction rate, recency, and compilation signal
- [ ] Dashboard — basic visibility into corpus health: coverage by domain, correction rate by path, model distribution

### Medium-term (Phase 3)
- [ ] Vector index on `solutions.intent` — embedding-based similarity for two-stage retrieval
- [ ] Retrieval action — given a set of taxonomy paths + stack context, return the top-N exemplars by durability + similarity
- [ ] Claude Code integration — inject retrieved exemplars as structured context before generation
- [ ] Benchmark — measure generation quality with vs. without retrieval augmentation on a fixed test set

### Longer-term (Phases 4–6)
- [ ] Recursive satisfaction evaluator with configurable `maxIterations` and satisfaction scoring
- [ ] Compositional planner — decompose multi-component features into a validated taxonomy path graph
- [ ] Pack format spec — define the structure for stack-specific seed corpus + taxonomy extension bundles
- [ ] Opt-in corpus sharing — infrastructure for contributing to and pulling from a shared open corpus
- [ ] Fine-tuning pipeline — use accumulated corpus slices to train and evaluate domain-specific model variants
