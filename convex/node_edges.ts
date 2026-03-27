import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { generateUlid } from "./lib/ulid";

// ─── Upsert ───────────────────────────────────────────────────────────────────
// Idempotent — inserts the edge only if fromSlug+toSlug+edgeType doesn't exist.
// Dedup is done in-memory after a single index hit on fromSlug.

export const upsert = internalMutation({
  args: {
    fromSlug: v.string(),
    toSlug:   v.string(),
    edgeType: v.string(),
  },
  returns: v.object({ ulid: v.string(), created: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("node_edges")
      .withIndex("by_from_slug", (q) => q.eq("fromSlug", args.fromSlug))
      .filter((q) =>
        q.and(
          q.eq(q.field("toSlug"),   args.toSlug),
          q.eq(q.field("edgeType"), args.edgeType),
        ),
      )
      .unique();

    if (existing) {
      return { ulid: existing.ulid, created: false };
    }

    const ulid = generateUlid();
    await ctx.db.insert("node_edges", {
      ulid,
      fromSlug:  args.fromSlug,
      toSlug:    args.toSlug,
      edgeType:  args.edgeType,
      createdAt: Date.now(),
    });
    return { ulid, created: true };
  },
});

// ─── List from Slug ───────────────────────────────────────────────────────────

export const listFromSlug = internalQuery({
  args: { slug: v.string() },
  returns: v.array(v.object({
    ulid:      v.string(),
    fromSlug:  v.string(),
    toSlug:    v.string(),
    edgeType:  v.string(),
    createdAt: v.number(),
  })),
  handler: async (ctx, { slug }) => {
    const docs = await ctx.db
      .query("node_edges")
      .withIndex("by_from_slug", (q) => q.eq("fromSlug", slug))
      .collect();
    return docs.map((doc) => ({
      ulid:      doc.ulid,
      fromSlug:  doc.fromSlug,
      toSlug:    doc.toSlug,
      edgeType:  doc.edgeType,
      createdAt: doc.createdAt,
    }));
  },
});
