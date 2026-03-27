import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { generateUlid } from "./lib/ulid";

// ─── Link ─────────────────────────────────────────────────────────────────────
// Links an ingestion record (solution or negative) to a node.
// No deduplication — each ingest event is a distinct observation.
// Frequency of the same link across events is itself a signal.

export const link = internalMutation({
  args: {
    recordUlid: v.string(),
    recordType: v.string(),    // "solution" | "negative"
    nodeSlug:   v.string(),
    edgeType:   v.string(),    // "introduces_risk" | "carries_risk" | "demonstrates_pattern"
    confidence: v.optional(v.number()),
  },
  returns: v.object({ ulid: v.string() }),
  handler: async (ctx, args) => {
    const ulid = generateUlid();
    await ctx.db.insert("record_nodes", {
      recordUlid: args.recordUlid,
      recordType: args.recordType,
      nodeSlug:   args.nodeSlug,
      edgeType:   args.edgeType,
      confidence: args.confidence,
      createdAt:  Date.now(),
    });
    return { ulid };
  },
});

// ─── List for Record ──────────────────────────────────────────────────────────

export const listForRecord = internalQuery({
  args: { recordUlid: v.string() },
  returns: v.array(v.object({
    recordUlid: v.string(),
    recordType: v.string(),
    nodeSlug:   v.string(),
    edgeType:   v.string(),
    confidence: v.optional(v.number()),
    createdAt:  v.number(),
  })),
  handler: async (ctx, { recordUlid }) => {
    const docs = await ctx.db
      .query("record_nodes")
      .withIndex("by_record", (q) => q.eq("recordUlid", recordUlid))
      .collect();
    return docs.map((doc) => ({
      recordUlid: doc.recordUlid,
      recordType: doc.recordType,
      nodeSlug:   doc.nodeSlug,
      edgeType:   doc.edgeType,
      confidence: doc.confidence,
      createdAt:  doc.createdAt,
    }));
  },
});

// ─── List for Node ────────────────────────────────────────────────────────────

export const listForNode = internalQuery({
  args: {
    nodeSlug: v.string(),
    edgeType: v.optional(v.string()),
  },
  returns: v.array(v.object({
    recordUlid: v.string(),
    recordType: v.string(),
    nodeSlug:   v.string(),
    edgeType:   v.string(),
    confidence: v.optional(v.number()),
    createdAt:  v.number(),
  })),
  handler: async (ctx, { nodeSlug, edgeType }) => {
    let query = ctx.db
      .query("record_nodes")
      .withIndex("by_node_slug", (q) => q.eq("nodeSlug", nodeSlug));

    if (edgeType !== undefined) {
      query = query.filter((q) => q.eq(q.field("edgeType"), edgeType)) as typeof query;
    }

    const docs = await query.collect();
    return docs.map((doc) => ({
      recordUlid: doc.recordUlid,
      recordType: doc.recordType,
      nodeSlug:   doc.nodeSlug,
      edgeType:   doc.edgeType,
      confidence: doc.confidence,
      createdAt:  doc.createdAt,
    }));
  },
});
