import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { generateUlid } from "./lib/ulid";

// ─── Get or Create ────────────────────────────────────────────────────────────
// Idempotent — returns existing node if slug already exists, otherwise inserts.
// Slug is the stable external identity for a node.

export const getOrCreate = internalMutation({
  args: {
    slug:        v.string(),
    type:        v.string(),
    label:       v.string(),
    description: v.optional(v.string()),
  },
  returns: v.object({ slug: v.string(), ulid: v.string() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("nodes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (existing) {
      return { slug: existing.slug, ulid: existing.ulid };
    }

    const ulid = generateUlid();
    await ctx.db.insert("nodes", {
      ulid,
      slug:        args.slug,
      type:        args.type,
      label:       args.label,
      description: args.description,
      createdAt:   Date.now(),
    });
    return { slug: args.slug, ulid };
  },
});

// ─── Get by Slug ──────────────────────────────────────────────────────────────

export const getBySlug = internalQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      ulid:        v.string(),
      slug:        v.string(),
      type:        v.string(),
      label:       v.string(),
      description: v.optional(v.string()),
      createdAt:   v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, { slug }) => {
    const doc = await ctx.db
      .query("nodes")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!doc) return null;
    return {
      ulid:        doc.ulid,
      slug:        doc.slug,
      type:        doc.type,
      label:       doc.label,
      description: doc.description,
      createdAt:   doc.createdAt,
    };
  },
});

// ─── List by Type ─────────────────────────────────────────────────────────────

export const listByType = internalQuery({
  args: { type: v.string() },
  returns: v.array(v.object({
    ulid:        v.string(),
    slug:        v.string(),
    type:        v.string(),
    label:       v.string(),
    description: v.optional(v.string()),
    createdAt:   v.number(),
  })),
  handler: async (ctx, { type }) => {
    const docs = await ctx.db
      .query("nodes")
      .withIndex("by_type", (q) => q.eq("type", type))
      .collect();
    return docs.map((doc) => ({
      ulid:        doc.ulid,
      slug:        doc.slug,
      type:        doc.type,
      label:       doc.label,
      description: doc.description,
      createdAt:   doc.createdAt,
    }));
  },
});
