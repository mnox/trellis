import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { generateUlid } from "./lib/ulid";

export const insert = internalMutation({
  args: {
    code: v.string(),
    intent: v.string(),
    taxonomyPaths: v.string(),      // JSON: TaxonomyPath[]
    resolvedEdges: v.optional(v.string()),
    failureMode: v.string(),
    failureDetail: v.optional(v.string()),
    stackContext: v.string(),       // JSON: StackContext
    model: v.string(),
    schemaVersion: v.string(),
  },
  returns: v.object({ ulid: v.string(), id: v.id("negatives") }),
  handler: async (ctx, args) => {
    const ulid = generateUlid();
    const id = await ctx.db.insert("negatives", {
      ulid,
      code: args.code,
      intent: args.intent,
      taxonomyPaths: args.taxonomyPaths,
      resolvedEdges: args.resolvedEdges,
      failureMode: args.failureMode,
      failureDetail: args.failureDetail,
      stackContext: args.stackContext,
      model: args.model,
      schemaVersion: args.schemaVersion,
      createdAt: Date.now(),
    });
    return { ulid, id };
  },
});
