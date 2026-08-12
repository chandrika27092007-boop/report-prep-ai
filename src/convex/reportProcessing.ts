"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { vly } from "../lib/vly-integrations";
import {
  AI_SYSTEM_PROMPT,
  DEFAULT_QUESTIONS,
  DISCLAIMER,
  HEALTH_METRICS_CATALOG,
  extractHealthMetrics,
  fallbackInsight,
  fallbackSummary,
  metricsSignature,
  type HealthMetricsByKey,
} from "../lib/health-metrics";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * ArogyaOS — Medical Report Intelligence
 *
 * Orchestrates the backend half of the pipeline:
 *   OCR text (already extracted client-side)
 *     → deterministic structured metric extraction
 *     → AI patient-friendly analysis (with deterministic fallback)
 *     → persist report + canonical health_metrics
 */

const aiResponseSchema = z.object({
  summary: z.string(),
  insights: z.record(z.string(), z.union([z.string(), z.null()])),
  questions: z.array(z.string()),
});

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function buildMetricsTable(metrics: HealthMetricsByKey): string {
  return HEALTH_METRICS_CATALOG.map((def) => {
    const m = metrics[def.key];
    const value =
      m.value !== undefined
        ? m.key === "bloodPressure" && m.valueDiastolic !== undefined
          ? `${m.value}/${m.valueDiastolic} ${m.unit}`
          : `${m.value} ${m.unit}`
        : "not found in report";
    return `- ${m.name} (${m.key}): ${value} | status: ${m.status} | reference: ${m.referenceLabel}`;
  }).join("\n");
}

async function runAiAnalysis(args: {
  ocrText: string;
  metrics: HealthMetricsByKey;
}): Promise<{
  summary: string;
  insights: Record<string, string | null>;
  questions: string[];
}> {
  const fallback: {
    summary: string;
    insights: Record<string, string | null>;
    questions: string[];
  } = {
    summary: fallbackSummary(args.metrics),
    insights: {},
    questions: DEFAULT_QUESTIONS,
  };

  if (!process.env.VLY_INTEGRATION_KEY) {
    console.warn(
      "[reportProcessing] VLY_INTEGRATION_KEY not set; using deterministic fallback analysis.",
    );
    return fallback;
  }

  try {
    const result = await vly.ai.completion(
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          {
            role: "user",
            content: `OCR text of the lab report:\n"""\n${args.ocrText.slice(
              0,
              12000,
            )}\n"""\n\nDeterministically extracted metrics:\n${buildMetricsTable(
              args.metrics,
            )}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 1200,
      },
      { timeout: 90000 },
    );

    if (!result.success || !result.data) {
      console.warn(
        "[reportProcessing] AI gateway error:",
        result.error ?? "no data",
      );
      return fallback;
    }

    const content = result.data.choices?.[0]?.message?.content;
    if (!content) return fallback;

    const parsed = aiResponseSchema.safeParse(JSON.parse(stripJsonFences(content)));
    if (!parsed.success) {
      console.warn(
        "[reportProcessing] AI response failed validation:",
        parsed.error.message,
      );
      return fallback;
    }

    return {
      summary: parsed.data.summary || fallback.summary,
      insights: parsed.data.insights ?? {},
      questions:
        parsed.data.questions.length > 0
          ? parsed.data.questions
          : DEFAULT_QUESTIONS,
    };
  } catch (error) {
    console.warn(
      "[reportProcessing] AI analysis failed; using deterministic fallback:",
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}

export const processReport = action({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    sourceType: v.union(v.literal("pdf"), v.literal("image")),
    fileSize: v.number(),
    ocrText: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ reportId: Id<"reports"> }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("You must be signed in to analyze a report.");
    }

    const text = args.ocrText.trim();
    if (text.length < 20) {
      throw new ConvexError(
        "No readable text could be extracted from this file. Please try a clearer scan or a text-based PDF.",
      );
    }

    // 1) Deterministic structured extraction (always available).
    const metrics = extractHealthMetrics(text);

    // 2) AI analysis with deterministic fallback.
    const analysis = await runAiAnalysis({ ocrText: text, metrics });

    // 3) Merge per-metric insights (AI preferred, fallback otherwise).
    const enriched: HealthMetricsByKey = { ...metrics };
    for (const def of HEALTH_METRICS_CATALOG) {
      const metric = enriched[def.key];
      if (metric.status === "out_of_range") {
        metric.insight = analysis.insights[def.key] ?? fallbackInsight(metric);
      } else if (metric.status === "in_range") {
        metric.insight = fallbackInsight(metric);
      } else {
        metric.insight = null;
      }
    }

    // 4) Persist report + canonical health metrics (via internal mutations;
    //    actions cannot write to the database directly).
    const reportId = await ctx.runMutation(internal.reports.insertReport, {
      userId,
      fileName: args.fileName,
      fileType: args.fileType,
      sourceType: args.sourceType,
      fileSize: args.fileSize,
      storageId: args.storageId,
      ocrText: text,
      status: "done",
      aiSummary: analysis.summary,
      questions: analysis.questions,
      disclaimer: DISCLAIMER,
    });

    await ctx.runMutation(internal.reports.insertHealthMetrics, {
      userId,
      reportId,
      metrics: enriched,
      sourceTextLength: text.length,
      signature: metricsSignature(enriched),
    });

    return { reportId };
  },
});
