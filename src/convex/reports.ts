import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { healthMetricsValidator } from "./schema";
import { internalMutation, mutation, query } from "./_generated/server";

/**
 * ArogyaOS — Medical Report Intelligence
 * Queries & mutations for report upload, retrieval, and the reusable
 * health-metrics export consumed by other ArogyaOS modules.
 */

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("You must be signed in to upload a report.");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const listReports = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }

    const [reports, metricDocs] = await Promise.all([
      ctx.db
        .query("reports")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("healthMetrics")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const metricCountByReport = new Map<string, { found: number; flags: number }>();
    for (const doc of metricDocs) {
      const entries = Object.values(doc.metrics);
      metricCountByReport.set(doc.reportId, {
        found: entries.filter((m) => m.status !== "not_found").length,
        flags: entries.filter((m) => m.status === "out_of_range").length,
      });
    }

    return reports.map((report) => {
      const counts = metricCountByReport.get(report._id) ?? { found: 0, flags: 0 };
      return {
        _id: report._id,
        _creationTime: report._creationTime,
        fileName: report.fileName,
        fileType: report.fileType,
        sourceType: report.sourceType,
        fileSize: report.fileSize,
        status: report.status,
        error: report.error ?? null,
        metricsFound: counts.found,
        metricsFlagged: counts.flags,
      };
    });
  },
});

export const getReport = query({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const report = await ctx.db.get(args.id);
    if (report === null || report.userId !== userId) {
      return null;
    }

    const metricsDoc = await ctx.db
      .query("healthMetrics")
      .withIndex("by_report", (q) => q.eq("reportId", args.id))
      .first();

    const originalUrl = report.storageId
      ? await ctx.storage.getUrl(report.storageId)
      : null;

    return {
      report: {
        _id: report._id,
        _creationTime: report._creationTime,
        fileName: report.fileName,
        fileType: report.fileType,
        sourceType: report.sourceType,
        fileSize: report.fileSize,
        status: report.status,
        error: report.error ?? null,
        ocrText: report.ocrText,
        aiSummary: report.aiSummary ?? null,
        questions: report.questions ?? null,
        disclaimer: report.disclaimer ?? null,
      },
      metrics: metricsDoc?.metrics ?? null,
      metricsSignature: metricsDoc?.signature ?? null,
      originalUrl,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Internal mutations (called by the reportProcessing action)          */
/* ------------------------------------------------------------------ */

export const insertReport = internalMutation({
  args: {
    userId: v.id("users"),
    fileName: v.string(),
    fileType: v.string(),
    sourceType: v.union(v.literal("pdf"), v.literal("image")),
    fileSize: v.number(),
    storageId: v.id("_storage"),
    ocrText: v.string(),
    status: v.union(v.literal("done"), v.literal("failed")),
    error: v.optional(v.string()),
    aiSummary: v.optional(v.string()),
    questions: v.optional(v.array(v.string())),
    disclaimer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("reports", args);
  },
});

export const insertHealthMetrics = internalMutation({
  args: {
    userId: v.id("users"),
    reportId: v.id("reports"),
    metrics: healthMetricsValidator,
    sourceTextLength: v.number(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("healthMetrics", args);
  },
});

/**
 * Reusable export for other ArogyaOS modules (Health Baseline,
 * Health Journey, Doctor Copilot). Returns the most recent report's
 * canonical metrics plus its signature, or null if none exist.
 */
export const latestHealthMetrics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const doc = await ctx.db
      .query("healthMetrics")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (doc === null) {
      return null;
    }

    const report = await ctx.db.get(doc.reportId);
    return {
      reportId: doc.reportId,
      reportFileName: report?.fileName ?? null,
      reportCreatedAt: report?._creationTime ?? doc._creationTime,
      signature: doc.signature,
      metrics: doc.metrics,
    };
  },
});
