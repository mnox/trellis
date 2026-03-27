import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { generateUlid } from "./lib/ulid";

// ─── Insert ───────────────────────────────────────────────────────────────────

export const insert = internalMutation({
  args: {
    code: v.string(),
    intent: v.string(),
    taxonomyPaths: v.string(),      // JSON: TaxonomyPath[]
    resolvedEdges: v.string(),      // JSON: Edge[]
    stackContext: v.string(),       // JSON: StackContext
    model: v.string(),
    confidence: v.optional(v.number()),
    schemaVersion: v.string(),
  },
  returns: v.object({ ulid: v.string(), id: v.id("solutions") }),
  handler: async (ctx, args) => {
    const ulid = generateUlid();
    const id = await ctx.db.insert("solutions", {
      ulid,
      code: args.code,
      intent: args.intent,
      taxonomyPaths: args.taxonomyPaths,
      resolvedEdges: args.resolvedEdges,
      stackContext: args.stackContext,
      model: args.model,
      confidence: args.confidence,
      schemaVersion: args.schemaVersion,
      createdAt: Date.now(),
    });
    return { ulid, id };
  },
});

// ─── Get by ULID ─────────────────────────────────────────────────────────────

export const getByUlid = internalQuery({
  args: { ulid: v.string() },
  returns: v.union(
    v.object({
      ulid: v.string(),
      code: v.string(),
      intent: v.string(),
      taxonomyPaths: v.string(),
      resolvedEdges: v.string(),
      stackContext: v.string(),
      model: v.string(),
      confidence: v.optional(v.number()),
      schemaVersion: v.string(),
      durabilityScore: v.optional(v.number()),
      compilationPassed: v.optional(v.boolean()),
      correctionCount: v.optional(v.number()),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, { ulid }) => {
    const doc = await ctx.db
      .query("solutions")
      .withIndex("by_ulid", (q) => q.eq("ulid", ulid))
      .unique();
    if (!doc) return null;
    return {
      ulid: doc.ulid,
      code: doc.code,
      intent: doc.intent,
      taxonomyPaths: doc.taxonomyPaths,
      resolvedEdges: doc.resolvedEdges,
      stackContext: doc.stackContext,
      model: doc.model,
      confidence: doc.confidence,
      schemaVersion: doc.schemaVersion,
      durabilityScore: doc.durabilityScore,
      compilationPassed: doc.compilationPassed,
      correctionCount: doc.correctionCount,
      createdAt: doc.createdAt,
    };
  },
});

// ─── Increment correction count ───────────────────────────────────────────────

export const incrementCorrectionCount = internalMutation({
  args: { ulid: v.string() },
  returns: v.null(),
  handler: async (ctx, { ulid }) => {
    const doc = await ctx.db
      .query("solutions")
      .withIndex("by_ulid", (q) => q.eq("ulid", ulid))
      .unique();
    if (!doc) return null;
    await ctx.db.patch(doc._id, {
      correctionCount: (doc.correctionCount ?? 0) + 1,
    });
    return null;
  },
});
