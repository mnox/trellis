import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * CRAPS Convex Schema
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

    schemaVersion: v.string(),
    createdAt: v.number(),
  })
    .index("by_ulid", ["ulid"])
    .index("by_failure_mode", ["failureMode"])
    .index("by_model", ["model"])
    .index("by_schema_version", ["schemaVersion"])
    .index("by_created", ["createdAt"])
    .index("by_version_failure", ["schemaVersion", "failureMode"]),
});
