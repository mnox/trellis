import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Trellis — LORE Convex Schema
 *
 * Three ingestion tables, one per reward signal:
 *   solutions   → code samples + taxonomy labels (taxonomy coverage signal)
 *   corrections → human overrides of solution labels (intent accuracy signal)
 *   negatives   → bad/failed solutions (edge validity signal)
 *
 * These signals MUST remain in separate tables. Do not merge them.
 * Each one feeds a different dimension of the training loop.
 *
 * Schema is intentionally sparse now — optional fields are placeholders
 * for the durability/decay scoring system (v2). Adding data to those
 * fields later requires no migration, just populating the field.
 */

export default defineSchema({

  // ─── Solutions ─────────────────────────────────────────────────────────────
  // Primary ingestion table.
  // Every piece of code that gets labeled with taxonomy paths lives here.
  //
  // Reward signal: code samples → taxonomy coverage
  // The model field determines training weight: Opus > Sonnet > Haiku.

  solutions: defineTable({
    // Stable external reference ID (ULID)
    ulid: v.string(),

    // The actual code snippet being labeled
    code: v.string(),

    // The original natural language input that prompted this code
    intent: v.string(),

    // JSON: TaxonomyPath[] — e.g. ["data|read|paginated", "ui|form|submission"]
    // Multiple paths are the norm, not the exception.
    taxonomyPaths: v.string(),

    // JSON: Edge[] — typed connections between co-occurring paths.
    // e.g. [{ from: "ui|form|submission", to: "data|write|basic", edgeType: "submit_handler" }]
    resolvedEdges: v.string(),

    // JSON: StackContext — { framework, libraries, language }
    // Stack is NOT encoded in taxonomy paths. It lives here.
    stackContext: v.string(),

    // Which LLM generated this code/labeling.
    // Training weight: "claude-opus-4-*" > "claude-sonnet-4-*" > "claude-haiku-*"
    model: v.string(),

    // Agent's self-reported confidence in the taxonomy labeling (0.0 – 1.0).
    // Low confidence = still captured (volume), lower training weight.
    confidence: v.optional(v.number()),

    // Taxonomy schema version at time of ingestion.
    // Allows filtering/re-labeling if the taxonomy changes significantly.
    schemaVersion: v.string(),

    // ── Durability / Decay scoring fields (v2 — populate later, no migration needed) ──

    // Overall durability score computed by the scoring system (0.0 – 1.0).
    // null = not yet scored.
    durabilityScore: v.optional(v.number()),

    // Whether this solution has been validated by compilation/tests.
    // null = not yet checked. true = passed. false = failed (see negatives table).
    compilationPassed: v.optional(v.boolean()),

    // Number of times a human correction has referenced this solution.
    // Higher = this labeling was frequently wrong = lower confidence weight.
    correctionCount: v.optional(v.number()),

    // JSON: string[] — file paths touched by this solution (e.g. ["src/api/auth.ts"])
    filePaths: v.optional(v.string()),

    createdAt: v.number(),
  })
    .index("by_ulid", ["ulid"])
    .index("by_model", ["model"])
    .index("by_schema_version", ["schemaVersion"])
    .index("by_confidence", ["confidence"])
    .index("by_durability", ["durabilityScore"])
    .index("by_created", ["createdAt"])
    // Compound: filter by schema version + model for training data export
    .index("by_version_model", ["schemaVersion", "model"])
    // Search across code content and intent for deduplication/similarity checks
    .searchIndex("search_solutions", {
      searchField: "intent",
      filterFields: ["schemaVersion", "model"],
    }),

  // ─── Corrections ───────────────────────────────────────────────────────────
  // Human overrides of solution taxonomy labels.
  // Highest-value signal — human corrections are ground truth.
  //
  // Reward signal: corrections → intent parsing accuracy
  // The flywheel corrects label noise over time. High correction rate on a
  // solution = the original labeling was wrong = de-weight that solution.

  corrections: defineTable({
    ulid: v.string(),

    // ULID of the solution being corrected
    originalId: v.string(),

    // JSON: TaxonomyPath[] — the corrected path set
    correctedPaths: v.string(),

    // Why this correction was made. Free text, but valuable signal.
    // e.g. "This is data|write|transactional not data|write|basic — it touches two tables"
    reason: v.string(),

    // Who or what made the correction.
    // "human" = highest weight. Future: agent self-correction = medium weight.
    correctedBy: v.optional(v.string()),

    // The schema version at time of correction (may differ from original)
    schemaVersion: v.string(),

    createdAt: v.number(),
  })
    .index("by_ulid", ["ulid"])
    .index("by_original_id", ["originalId"])
    .index("by_corrected_by", ["correctedBy"])
    .index("by_schema_version", ["schemaVersion"])
    .index("by_created", ["createdAt"]),

  // ─── Negatives ─────────────────────────────────────────────────────────────
  // Failed or bad solutions — code that did NOT work or was the wrong approach.
  // Negative examples are valuable training signal: what NOT to produce.
  //
  // Reward signal: negatives → edge validity
  // A path combination that consistently produces failures = invalid edge.

  // ─── Taxonomy Gaps ──────────────────────────────────────────────────────────
  // Signals from the labeling agent that the taxonomy was insufficient.
  // Captured when the agent cannot adequately express the architectural pattern
  // it observed using the current taxonomy paths or edge types.
  //
  // This table is the primary input to taxonomy evolution.
  // An inference agent operates over these records to:
  //   1. Identify missing nodes (recurring patterns with no path)
  //   2. Identify missing domains (concerns outside the 8 L1 domains)
  //   3. Identify missing edge types (relationships with no type)
  //   4. Identify paths that are too coarse (high ambiguity, low signal)
  //
  // solutionId is optional — a gap may be reported alongside an ingested
  // solution (the best-approximation labeling) or standalone when the
  // agent determines the code is too poorly classified to store as positive.

  taxonomy_gaps: defineTable({
    ulid: v.string(),

    // Optional: ULID of a related solution that was ingested with approximate paths
    solutionId: v.optional(v.string()),

    // The original NL intent that prompted the code being labeled
    intent: v.string(),

    // JSON: TaxonomyPath[] — the best-approximation paths that WERE assigned.
    // Empty array is valid when no existing path was a reasonable fit at all.
    approximatePaths: v.string(),

    // Free-text: what the taxonomy failed to express and why.
    // This is the primary signal — written by the labeling agent in its own words.
    // e.g. "The code implements a real-time collaborative cursor system. The closest
    // path is state|client|context but that loses the real-time sync and presence
    // dimensions entirely. Neither data|read|realtime nor state|optimistic|update
    // captures the bidirectional cursor broadcast pattern."
    description: v.string(),

    // Structured classification of the gap type.
    // missing_node      — the domain exists but no L2/L3 node fits
    // missing_domain    — the concern falls outside all 8 L1 domains
    // missing_edge_type — two co-occurring paths have a relationship no edge type captures
    // path_too_coarse   — a path exists but is too broad to distinguish meaningfully different patterns
    // path_ambiguous    — multiple paths apply equally; the taxonomy provides no way to choose
    gapType: v.string(),

    // Optional structured proposal — what WOULD have worked.
    // For missing_node: a suggested path in L1|L2|L3 format
    proposedPath: v.optional(v.string()),
    // For missing_domain: a suggested new L1 domain name
    proposedDomain: v.optional(v.string()),
    // For missing_edge_type: a suggested new edge type name
    proposedEdgeType: v.optional(v.string()),

    // JSON: StackContext — stack may be relevant to whether the gap is stack-specific
    stackContext: v.string(),

    model: v.string(),
    schemaVersion: v.string(),
    createdAt: v.number(),
  })
    .index("by_ulid", ["ulid"])
    .index("by_gap_type", ["gapType"])
    .index("by_solution_id", ["solutionId"])
    .index("by_schema_version", ["schemaVersion"])
    .index("by_created", ["createdAt"])
    // Compound: inference agent's primary query — all gaps of a given type for a schema version
    .index("by_version_gap_type", ["schemaVersion", "gapType"])
    .searchIndex("search_gaps", {
      searchField: "description",
      filterFields: ["gapType", "schemaVersion"],
    }),

  // ─── Negatives ─────────────────────────────────────────────────────────────
  negatives: defineTable({
    ulid: v.string(),

    // The code that failed or was wrong
    code: v.string(),

    // The original intent that prompted this code
    intent: v.string(),

    // JSON: TaxonomyPath[] — what this code was (incorrectly) attempting
    taxonomyPaths: v.string(),

    // JSON: Edge[] — the edges that were attempted (may be invalid)
    resolvedEdges: v.optional(v.string()),

    // How/why this solution failed.
    // Categories: "compilation_error" | "test_failure" | "wrong_approach" |
    //             "security_flaw" | "type_error" | "runtime_error" | "human_rejected"
    failureMode: v.string(),

    // Optional detail: the actual error message, test output, or rejection reason
    failureDetail: v.optional(v.string()),

    // JSON: StackContext
    stackContext: v.string(),

    // Which model generated this (negative examples from stronger models are more surprising)
    model: v.string(),

    // JSON: string[] — file paths touched
    filePaths: v.optional(v.string()),

    schemaVersion: v.string(),
    createdAt: v.number(),
  })
    .index("by_ulid", ["ulid"])
    .index("by_failure_mode", ["failureMode"])
    .index("by_model", ["model"])
    .index("by_schema_version", ["schemaVersion"])
    .index("by_created", ["createdAt"])
    .index("by_version_failure", ["schemaVersion", "failureMode"]),

  // ─── Nodes ──────────────────────────────────────────────────────────────────
  // Generic graph nodes. Risks, patterns, facets, and any future node type
  // all live here. The type field is an open string — no enums.
  // New node types require zero schema changes; add them at ingest time.
  //
  // Examples:
  //   { slug: "prompt-injection", type: "risk",    label: "Prompt Injection" }
  //   { slug: "ddd",              type: "pattern",  label: "Domain Driven Design" }
  //   { slug: "security",         type: "facet",    label: "Security" }

  nodes: defineTable({
    ulid:        v.string(),
    slug:        v.string(),              // kebab-case stable identifier
    type:        v.string(),              // open string: "risk" | "pattern" | "facet" | anything
    label:       v.string(),              // human-readable display name
    description: v.optional(v.string()),
    createdAt:   v.number(),
  })
    .index("by_ulid", ["ulid"])
    .index("by_slug", ["slug"])           // primary dedup key for get-or-create
    .index("by_type", ["type"]),

  // ─── Node Edges ─────────────────────────────────────────────────────────────
  // Typed relationships between nodes.
  // e.g. "prompt-injection" --has_facet--> "security"
  //      "n-plus-one-queries" --has_facet--> "performance"
  // Edge types are open strings — no enums. Upserted idempotently.

  node_edges: defineTable({
    ulid:      v.string(),
    fromSlug:  v.string(),
    toSlug:    v.string(),
    edgeType:  v.string(),               // open string: "has_facet" | "implies_risk" | "related_to"
    createdAt: v.number(),
  })
    .index("by_ulid",      ["ulid"])
    .index("by_from_slug", ["fromSlug"])
    .index("by_to_slug",   ["toSlug"])
    .index("by_from_type", ["fromSlug", "edgeType"]),

  // ─── Record Nodes ────────────────────────────────────────────────────────────
  // Links between ingestion records (solutions, negatives) and nodes.
  // Carries the relationship type and an optional confidence score.
  //
  // Edge types:
  //   introduces_risk      — the code directly introduces this risk
  //   carries_risk         — the code is adjacent to this risk (may handle it)
  //   demonstrates_pattern — the code demonstrates this architectural pattern
  //
  // Duplicate links are allowed — multiple ingest events asserting the same
  // relationship are distinct signal (frequency is information).

  record_nodes: defineTable({
    recordUlid: v.string(),              // ULID of the solution or negative
    recordType: v.string(),              // "solution" | "negative"
    nodeSlug:   v.string(),
    edgeType:   v.string(),              // see edge types above — open string
    confidence: v.optional(v.number()),
    createdAt:  v.number(),
  })
    .index("by_record",      ["recordUlid"])
    .index("by_node_slug",   ["nodeSlug"])
    .index("by_record_edge", ["recordUlid", "edgeType"])
    .index("by_node_edge",   ["nodeSlug", "edgeType"])
    .index("by_record_type", ["recordType", "nodeSlug"]),
});
