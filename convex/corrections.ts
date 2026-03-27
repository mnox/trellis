import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { generateUlid } from "./lib/ulid";

export const insert = internalMutation({
  args: {
    originalId: v.string(),         // ULID of the solution being corrected
    correctedPaths: v.string(),     // JSON: TaxonomyPath[]
    reason: v.string(),
    correctedBy: v.optional(v.string()),
    schemaVersion: v.string(),
  },
  returns: v.object({ ulid: v.string(), id: v.id("corrections") }),
  handler: async (ctx, args) => {
    const ulid = generateUlid();
    const id = await ctx.db.insert("corrections", {
      ulid,
      originalId: args.originalId,
      correctedPaths: args.correctedPaths,
      reason: args.reason,
      correctedBy: args.correctedBy ?? "human",
      schemaVersion: args.schemaVersion,
      createdAt: Date.now(),
    });
    return { ulid, id };
  },
});
