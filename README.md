# CRAPS

**Compositional Retrieval-Augmented Planning System**

A taxonomy-driven code planning system that accumulates labeled training data passively as a side effect of normal development work. The long-term goal is a self-improving code generation system that gets better the more you use it.

---

## What this is

CRAPS turns every code generation session into a training data collection session. When an LLM agent produces code, it simultaneously labels that code with structured taxonomy paths describing the architectural patterns it demonstrates. Over time, this builds a dense, high-quality dataset that can be used to improve code generation for your specific stack.

The core insight: natural language inputs map to deterministic hierarchical taxonomy paths (e.g. `data|read|paginated`, `ui|form|submission`) that describe *architectural intent* independent of any specific framework or library. A form that submits to a database write is the same architectural pattern whether it uses Convex, Prisma, or raw SQL — the taxonomy captures the intent, and the stack context lives as metadata on each ingested record.

---

## Current state (MVP — v0.1.0)

The MVP implements the data tap: passive labeled data collection via an MCP server.

### What's built

**Taxonomy schema** (`taxonomy/index.ts`)
- 60 nodes across 8 architectural domains
- 3-level path format: `L1|L2|L3`
- 14 typed edge types encoding relationships between co-occurring patterns
- LLM-legible node descriptions and examples (prompting context for the labeling agent)
- Schema version `1.0.0` — new nodes can be added without retraining

**MCP server** (Convex HTTP + JSON-RPC 2.0)
Three tools that an LLM agent calls during development:

| Tool | Purpose | Training signal |
|------|---------|----------------|
| `ingest_solution` | Record working code + taxonomy labels | Taxonomy coverage |
| `ingest_correction` | Human override of taxonomy labels | Intent parsing accuracy |
| `ingest_negative` | Record failed/rejected code + failure mode | Edge validity |

**Convex storage layer** (`convex/schema.ts`)
Three tables, one per reward signal — intentionally never merged:
- `solutions` — labeled code samples with stack context, model, and confidence
- `corrections` — human overrides linked to original solutions
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
solutions   → taxonomy coverage       (code samples → which patterns exist)
corrections → intent parsing accuracy (human overrides → what the code actually meant)
negatives   → edge validity           (failures → which pattern combinations don't work)
```

These signals feed different dimensions of the eventual training loop. Merging them into a single table would destroy that separation.

---

## Long-term vision

### Phase 1 — Data tap (current)
Passive accumulation of labeled training data. Every code generation session produces structured records. The system gets richer with use without requiring any explicit training workflow.

### Phase 2 — Durability & decay scoring
Not all training data ages equally. A working code sample from 6 months ago may be stale if the underlying library changed. The schema already includes optional fields (`durabilityScore`, `compilationPassed`, `correctionCount`) that the scoring system will populate — no migration required.

Scoring dimensions:
- **Taxonomy coverage** — how many times has this pattern been successfully ingested?
- **Correction rate** — how often does this labeling get corrected? (already tracked via `correctionCount`)
- **Compilation/test pass rate** — does the code actually run? (tracked via `compilationPassed`)
- **Recency** — newer solutions weighted higher for fast-moving stacks

### Phase 3 — Engram-style lookup layer
At inference time, the system retrieves the highest-durability examples for the inferred taxonomy paths and injects them as context. Instead of generating from scratch, the model generates *from a foundation of validated, stack-specific patterns*.

The retrieval key is the taxonomy path combination. `data|read|realtime` + `ui|form|submission` retrieves the best examples of "a form that submits and shows live query results" — regardless of which stack the user is on, because stack is a filter, not part of the key.

### Phase 4 — Recursive satisfaction evaluator
A configurable `max_iterations` loop (Vercel AI SDK-style) that:
1. Generates a solution and labels it with taxonomy paths
2. Evaluates the solution against the retrieved exemplars
3. If satisfaction threshold not met, iterates with the failure as a negative example
4. Stops when satisfied or `max_iterations` reached

The evaluator improves over time because the exemplar set it evaluates against improves over time.

### Phase 5 — SDK
CRAPS is designed to eventually be a stack-agnostic SDK. The taxonomy is the stable core. Stack-specific "packs" (the NextJS/Shadcn/Convex first-party pack, a Rails pack, a FastAPI pack) are filtered views of the same data, not separate systems.

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

The first `convex dev` run will prompt you to create or link a Convex project. Once complete, it will generate `convex/_generated/` and start the dev server.

### Add to Claude Code

Once deployed, add the MCP server to your Claude Code config:

```json
{
  "mcpServers": {
    "craps": {
      "url": "https://<your-convex-deployment>.convex.site/mcp"
    }
  }
}
```

From that point on, the agent will passively ingest labeled solutions, corrections, and negatives as a side effect of normal development work.

### Generate taxonomy JSON

```bash
npx tsx taxonomy/generate-json.ts
```

Outputs `taxonomy/nodes.json` — a portable snapshot of the full taxonomy useful for inspection, versioning, or external tooling.

---

## Architecture

```
craps/
├── taxonomy/
│   ├── index.ts            ← Taxonomy definition: nodes, edge types, helpers
│   └── generate-json.ts    ← Script to export taxonomy/nodes.json
└── convex/
    ├── schema.ts            ← Three ingestion tables
    ├── http.ts              ← HTTP router: /mcp endpoint
    ├── solutions.ts         ← Internal mutations for solutions
    ├── corrections.ts       ← Internal mutations for corrections
    ├── negatives.ts         ← Internal mutations for negatives
    └── mcp/
        ├── tools.ts         ← MCP tool definitions (JSON schema)
        ├── instructions.ts  ← LLM system prompt
        ├── handler.ts       ← JSON-RPC 2.0 request handler
        └── actions.ts       ← Internal actions bridging handler → mutations
```

### Key design decisions

**Taxonomy is generic, not stack-specific.** `data|read|paginated` accumulates training data from every stack where paginated reads exist. Stack specificity lives on the solution record (`stackContext: { framework, libraries, language }`), not in the taxonomy path. At inference time, filter by stack; at training time, learn the pattern.

**Agent-native labeling.** No rigid validation rules. The taxonomy provides LLM-legible descriptions and examples as prompting context. Novel paths in valid `L1|L2|L3` format are accepted — they signal taxonomy gaps for future schema versions. Label noise is corrected by the `ingest_correction` flywheel.

**Convex as the backend.** Convex's reactive query model, built-in full-text search, and HTTP action support make it a natural fit for an MCP server with a real-time data layer. The HTTP router handles JSON-RPC 2.0 directly — no separate server process.

**Schema versioning without retraining.** Adding new taxonomy nodes = add entries to `taxonomy/index.ts`, bump `SCHEMA_VERSION`. Existing data retains its original version tag, allowing filtered re-labeling of old records when the taxonomy evolves. No model retraining required for taxonomy changes.

---

## Taxonomy path format

All paths are three levels deep: `L1|L2|L3`

- **L1** — Architectural domain (`ui`, `routing`, `data`, `server`, `auth`, `state`, `styling`, `types`)
- **L2** — Concern within that domain (`read`, `write`, `form`, `guard`, etc.)
- **L3** — Behavioral specificity (`paginated`, `optimistic`, `submission`, `realtime`, etc.)

A single solution typically maps to 2–6 paths. A form component that reads live data, validates with a schema, submits to a mutation, and shows optimistic feedback would emit something like:

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
ui|form|submission  →[submit_handler]→    data|write|optimistic
ui|form|schema      →[type_contract]→     ui|form|fields
data|write|optimistic →[optimistic_binding]→ state|optimistic|update
```

---

## Edge types

| Edge | Meaning |
|------|---------|
| `submit_handler` | Form submission wired to a write operation |
| `data_binding` | Component reads from a reactive data source |
| `optimistic_binding` | Optimistic UI state tied to a pending write |
| `schema_backing` | A read/write operation backed by a schema definition |
| `auth_guard` | A route, query, or mutation enforces an auth check |
| `identity_propagation` | Auth identity flows into a downstream operation |
| `revalidate_after` | A write triggers cache/data invalidation |
| `webhook_sync` | Inbound webhook triggers a local write |
| `variant_binding` | Component appearance driven by a variant system |
| `url_state_sync` | Component state encoded in / driven by URL params |
| `error_boundary` | Error state caught and displayed via a UI boundary |
| `loading_state` | Async operation wired to a loading/skeleton UI |
| `type_contract` | A validator/type constrains multiple co-occurring paths |
| `job_trigger` | A write or event triggers an async background job |

---

## Next steps

- [ ] `npx convex dev` — deploy and connect to Claude Code
- [ ] First real ingestion session — validate the taxonomy against actual usage
- [ ] Taxonomy gaps — watch for novel paths the agent emits; review for inclusion in v1.1
- [ ] Export tooling — query interface for inspecting accumulated data by path/stack/model
- [ ] Durability scoring — Phase 2 scoring system (schema already has the fields)
- [ ] Vector index — add embedding-based similarity search to `solutions` for deduplication and retrieval
