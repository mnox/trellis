import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { generateUlid } from "./lib/ulid";

export const insert = internalMutation({
  args: {
    solutionId: v.optional(v.string()),
    intent: v.string(),
    approximatePaths: v.string(),   // JSON: TaxonomyPath[]
    description: v.string(),
    gapType: v.string(),
    proposedPath: v.optional(v.string()),
    proposedDomain: v.optional(v.string()),
    proposedEdgeType: v.optional(v.string()),
    stackContext: v.string(),       // JSON: StackContext
    model: v.string(),
    schemaVersion: v.string(),
  },
  returns: v.object({ ulid: v.string(), id: v.id("taxonomy_gaps") }),
  handler: async (ctx, args) => {
    const ulid = generateUlid();
    const id = await ctx.db.insert("taxonomy_gaps", {
      ulid,
      solutionId: args.solutionId,
      intent: args.intent,
      approximatePaths: args.approximatePaths,
      description: args.description,
      gapType: args.gapType,
      proposedPath: args.proposedPath,
      proposedDomain: args.proposedDomain,
      proposedEdgeType: args.proposedEdgeType,
      stackContext: args.stackContext,
      model: args.model,
      schemaVersion: args.schemaVersion,
      createdAt: Date.now(),
    });
    return { ulid, id };
  },
});
