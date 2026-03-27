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
- Schema version `1.0.0` — add new nodes without retraining

**MCP server** (Convex HTTP + JSON-RPC 2.0)

Three tools the agent calls during development:

| Tool | Purpose | Reward signal |
|------|---------|--------------|
| `ingest_solution` | Working code + taxonomy labels | Taxonomy coverage |
| `ingest_correction` | Human override of labels | Intent parsing accuracy |
| `ingest_negative` | Failed/rejected code + failure mode | Edge validity |

**Convex storage** (`convex/schema.ts`)

Three tables, one per reward signal — intentionally never merged:
- `solutions` — labeled code with stack context, model, and confidence
- `corrections` — human overrides linked to the original solution
- `negatives` — failed solutions with failure mode classification

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

### Phase 1 — LORE (current)
Passive accumulation of labeled training data. Every code generation session produces structured records. The system enriches itself through use.

### Phase 2 — Durability & decay scoring
Not all training data ages equally. The schema already has optional fields (`durabilityScore`, `compilationPassed`, `correctionCount`) for the scoring system — no migration required when Phase 2 lands.

Scoring dimensions:
- **Coverage** — how many validated examples exist for this pattern?
- **Correction rate** — how often does this labeling get overridden? (tracked via `correctionCount`)
- **Compilation pass rate** — does the code actually run? (tracked via `compilationPassed`)
- **Recency** — newer solutions weighted higher for fast-moving stacks

### Phase 3 — Retrieval layer
At inference time, retrieve the highest-durability examples for the inferred taxonomy path combination and inject them as context. The retrieval key is the path set. `data|read|realtime` + `ui|form|submission` retrieves the best examples of "a form that submits and shows live query results" — stack-filtered, not stack-constrained.

### Phase 4 — Recursive satisfaction evaluator
A configurable `max_iterations` loop that:
1. Generates a solution and labels it
2. Evaluates against retrieved exemplars
3. If below satisfaction threshold — iterates with the failure as a negative
4. Stops when satisfied or `max_iterations` reached

The evaluator improves because the exemplar set it evaluates against improves.

### Phase 5 — Trellis SDK
Stack-agnostic, open-source SDK. The taxonomy is the stable core. Stack-specific packs (NextJS/Shadcn/Convex, Rails, FastAPI) are filtered views of the same data, not separate systems. Ship a pack, get LORE for free.

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
    ├── schema.ts            ← solutions, corrections, negatives tables
    ├── http.ts              ← HTTP router: /mcp
    ├── solutions.ts         ← Internal mutations
    ├── corrections.ts       ← Internal mutations
    ├── negatives.ts         ← Internal mutations
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

## Next steps

- [ ] `npx convex dev` — deploy and wire up to Claude Code
- [ ] First real ingestion session — validate taxonomy against actual usage
- [ ] Watch for novel paths the agent emits — review for v1.1 taxonomy additions
- [ ] Export/query interface for inspecting accumulated data by path, stack, and model
- [ ] Phase 2: durability scoring system (schema fields already exist)
- [ ] Phase 3: vector index on `solutions` for embedding-based retrieval
