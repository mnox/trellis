import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { SCHEMA_VERSION, isValidPathFormat } from "../../taxonomy/index";

// ─── Shared validators ────────────────────────────────────────────────────────

const stackContextValidator = v.object({
  framework: v.string(),
  libraries: v.array(v.string()),
  language: v.string(),
});

const edgeValidator = v.object({
  from: v.string(),
  to: v.string(),
  edgeType: v.string(),
  context: v.optional(v.string()),
});

// ─── ingest_solution ──────────────────────────────────────────────────────────

export const ingestSolution = internalAction({
  args: {
    code: v.string(),
    intent: v.string(),
    taxonomy_paths: v.array(v.string()),
    resolved_edges: v.array(edgeValidator),
    stack_context: stackContextValidator,
    model: v.string(),
    confidence: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    // Soft-validate path formats — warn on invalid, still ingest
    const invalidPaths = args.taxonomy_paths.filter((p) => !isValidPathFormat(p));
    const warnings: string[] = [];
    if (invalidPaths.length > 0) {
      warnings.push(
        `Warning: ${invalidPaths.length} path(s) have non-standard format: ${invalidPaths.join(", ")}. ` +
        `Expected L1|L2|L3 with lowercase alphanumeric segments. Ingested anyway.`,
      );
    }

    const { ulid } = await ctx.runMutation(internal.solutions.insert, {
      code: args.code,
      intent: args.intent,
      taxonomyPaths: JSON.stringify(args.taxonomy_paths),
      resolvedEdges: JSON.stringify(args.resolved_edges),
      stackContext: JSON.stringify(args.stack_context),
      model: args.model,
      confidence: args.confidence,
      schemaVersion: SCHEMA_VERSION,
    });

    const pathList = args.taxonomy_paths.join(", ");
    const edgeCount = args.resolved_edges.length;
    const confidenceStr = args.confidence != null
      ? ` | confidence: ${(args.confidence * 100).toFixed(0)}%`
      : "";

    const lines = [
      `Ingested solution ${ulid}`,
      `Paths (${args.taxonomy_paths.length}): ${pathList}`,
      `Edges: ${edgeCount}${confidenceStr}`,
      `Stack: ${args.stack_context.framework} [${args.stack_context.libraries.join(", ")}]`,
      `Model: ${args.model} | Schema: v${SCHEMA_VERSION}`,
      ...warnings,
    ];

    return lines.join("\n");
  },
});

// ─── ingest_correction ────────────────────────────────────────────────────────

export const ingestCorrection = internalAction({
  args: {
    original_id: v.string(),
    corrected_paths: v.array(v.string()),
    reason: v.string(),
    corrected_by: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    // Verify the original solution exists
    const original = await ctx.runQuery(internal.solutions.getByUlid, {
      ulid: args.original_id,
    });

    if (!original) {
      return (
        `Warning: Solution ${args.original_id} not found. ` +
        `Correction recorded anyway — ULID may be from a previous deployment. ` +
        `Paths: ${args.corrected_paths.join(", ")}`
      );
    }

    const { ulid } = await ctx.runMutation(internal.corrections.insert, {
      originalId: args.original_id,
      correctedPaths: JSON.stringify(args.corrected_paths),
      reason: args.reason,
      correctedBy: args.corrected_by ?? "human",
      schemaVersion: SCHEMA_VERSION,
    });

    // Increment the correction count on the original solution
    await ctx.runMutation(internal.solutions.incrementCorrectionCount, {
      ulid: args.original_id,
    });

    const originalPaths = JSON.parse(original.taxonomyPaths) as string[];

    return [
      `Correction recorded: ${ulid}`,
      `Original solution: ${args.original_id}`,
      `Original paths: ${originalPaths.join(", ")}`,
      `Corrected to: ${args.corrected_paths.join(", ")}`,
      `Corrected by: ${args.corrected_by ?? "human"}`,
    ].join("\n");
  },
});

// ─── ingest_negative ─────────────────────────────────────────────────────────

export const ingestNegative = internalAction({
  args: {
    code: v.string(),
    intent: v.string(),
    taxonomy_paths: v.array(v.string()),
    resolved_edges: v.optional(v.array(edgeValidator)),
    failure_mode: v.string(),
    failure_detail: v.optional(v.string()),
    stack_context: stackContextValidator,
    model: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const { ulid } = await ctx.runMutation(internal.negatives.insert, {
      code: args.code,
      intent: args.intent,
      taxonomyPaths: JSON.stringify(args.taxonomy_paths),
      resolvedEdges: args.resolved_edges ? JSON.stringify(args.resolved_edges) : undefined,
      failureMode: args.failure_mode,
      failureDetail: args.failure_detail,
      stackContext: JSON.stringify(args.stack_context),
      model: args.model,
      schemaVersion: SCHEMA_VERSION,
    });

    return [
      `Negative example recorded: ${ulid}`,
      `Failure mode: ${args.failure_mode}`,
      `Paths attempted: ${args.taxonomy_paths.join(", ")}`,
      `Stack: ${args.stack_context.framework} [${args.stack_context.libraries.join(", ")}]`,
      `Model: ${args.model}`,
      args.failure_detail ? `Detail: ${args.failure_detail.slice(0, 200)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  },
});
