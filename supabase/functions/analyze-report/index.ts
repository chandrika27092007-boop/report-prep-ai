/**
 * ArogyaOS — Medical Report Intelligence · analyze-report
 *
 * Supabase Edge Function.
 *
 * Called by the report UI after OCR + deterministic metric extraction have
 * happened CLIENT-SIDE. This function:
 *   1. Verifies the caller's Supabase JWT and that the report belongs to them.
 *   2. Re-validates the extracted metrics (never re-runs OCR).
 *   3. Loads the patient's previous report's metrics for trend context.
 *   4. Calls the existing ArogyaOS AI provider (VLY AI gateway) with the
 *      shared no-diagnosis prompt. Falls back to deterministic copy ONLY when
 *      the provider is unreachable or fails validation.
 *   5. Persists the canonical `health_metrics` document (the single
 *      health-data source for Health Baseline / Health Journey /
 *      Doctor Copilot) and the `ai_analyses` row.
 *
 * Secrets (set in Supabase function secrets / env):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, VLY_INTEGRATION_KEY
 */

import { createClient } from "npm:@supabase/supabase-js";
import {
  AI_SYSTEM_PROMPT,
  DEFAULT_QUESTIONS,
  DISCLAIMER,
  HEALTH_METRICS_CATALOG,
  extractHealthMetrics,
  fallbackInsight,
  fallbackSummary,
  isHealthMetricsByKey,
  metricsSignature,
  buildTrendContext,
  type HealthMetricsByKey,
} from "../../src/lib/health-metrics.ts";

const AI_ENDPOINT = "https://integrations.vly.ai/v1/llm/chat/completions";
const AI_MODEL = "gpt-4o-mini";
const AI_PROVIDER = "vly-gateway";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

interface AiAnalysis {
  summary: string;
  insights: Record<string, string | null>;
  questions: string[];
}

function parseAiJson(raw: string): AiAnalysis | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.summary !== "string") return null;

  const insights: Record<string, string | null> = {};
  if (obj.insights && typeof obj.insights === "object") {
    for (const [key, value] of Object.entries(
      obj.insights as Record<string, unknown>,
    )) {
      insights[key] = typeof value === "string" ? value : null;
    }
  }

  const questions = Array.isArray(obj.questions)
    ? obj.questions.filter((q): q is string => typeof q === "string")
    : [];

  return { summary: obj.summary, insights, questions };
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
  trendContext: string | null;
}): Promise<AiAnalysis> {
  const fallback: AiAnalysis = {
    summary: fallbackSummary(args.metrics),
    insights: {},
    questions: DEFAULT_QUESTIONS,
  };

  const apiKey = Deno.env.get("VLY_INTEGRATION_KEY");
  if (!apiKey) {
    console.warn(
      "[analyze-report] VLY_INTEGRATION_KEY not set; using deterministic fallback.",
    );
    return fallback;
  }

  const messages = [
    { role: "system", content: AI_SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `OCR text of the lab report:\n"""\n${args.ocrText.slice(0, 12000)}\n"""\n\n` +
        `Deterministically extracted metrics:\n${buildMetricsTable(args.metrics)}` +
        (args.trendContext ? `\n\n${args.trendContext}` : ""),
    },
  ];

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[analyze-report] AI gateway HTTP ${response.status}:`, text.slice(0, 300));
      return fallback;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return fallback;

    const parsed = parseAiJson(content);
    if (!parsed) {
      console.warn("[analyze-report] AI response failed JSON validation.");
      return fallback;
    }

    return {
      summary: parsed.summary || fallback.summary,
      insights: parsed.insights ?? {},
      questions:
        parsed.questions.length > 0 ? parsed.questions : DEFAULT_QUESTIONS,
    };
  } catch (error) {
    console.warn(
      "[analyze-report] AI analysis failed; using deterministic fallback:",
      error instanceof Error ? error.message : String(error),
    );
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Supabase is not configured on the server." }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return json({ error: "Missing authorization token." }, 401);
  }

  // Authenticate the caller with their own session JWT; RLS then scopes every
  // query below to this patient.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return json({ error: "Invalid or expired session." }, 401);
  }

  let body: {
    reportId?: string;
    ocrText?: string;
    metrics?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const { reportId, ocrText, metrics: clientMetrics } = body;
  if (!reportId || typeof reportId !== "string") {
    return json({ error: "reportId is required." }, 400);
  }
  if (typeof ocrText !== "string" || ocrText.trim().length < 20) {
    return json({ error: "ocrText is required and must be readable text." }, 400);
  }

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, patient_id, ocr_text, status, created_at")
    .eq("id", reportId)
    .maybeSingle();
  if (reportError) {
    console.error("[analyze-report] report lookup failed:", reportError);
    return json({ error: "Could not load the report." }, 500);
  }
  if (!report || report.patient_id !== user.id) {
    return json({ error: "Report not found." }, 404);
  }

  // Re-validate the client-extracted metrics; fall back to a server-side
  // re-extraction from the OCR text if the shape is wrong. Never re-OCR.
  let metrics: HealthMetricsByKey;
  if (isHealthMetricsByKey(clientMetrics)) {
    metrics = clientMetrics;
  } else {
    console.warn("[analyze-report] client metrics failed shape guard; re-extracting from OCR text.");
    metrics = extractHealthMetrics(ocrText);
  }

  // Trend context: the patient's previous report's metrics, if any.
  const { data: previous } = await supabase
    .from("health_metrics")
    .select("metrics, report_id, created_at")
    .eq("patient_id", user.id)
    .neq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(1);

  const previousRow = previous && previous.length > 0 ? previous[0] : null;
  const trendContext =
    previousRow && isHealthMetricsByKey(previousRow.metrics)
      ? buildTrendContext(previousRow.metrics, metrics, previousRow.created_at)
      : null;

  // AI analysis (deterministic fallback only when the provider fails).
  const analysis = await runAiAnalysis({ ocrText, metrics, trendContext });

  // Merge per-metric insights into the canonical document.
  const enriched = { ...metrics } as HealthMetricsByKey;
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

  // Persist: reports.status → done, upsert health_metrics + ai_analyses.
  const { error: updateError } = await supabase
    .from("reports")
    .update({ status: "done", error: null })
    .eq("id", reportId)
    .eq("patient_id", user.id);
  if (updateError) {
    console.error("[analyze-report] status update failed:", updateError);
    return json({ error: "Could not finalize the report." }, 500);
  }

  const { error: metricsError } = await supabase.from("health_metrics").upsert(
    {
      patient_id: user.id,
      report_id: reportId,
      metrics: enriched,
      signature: metricsSignature(enriched),
      source_text_length: ocrText.length,
    },
    { onConflict: "report_id" },
  );
  if (metricsError) {
    console.error("[analyze-report] health_metrics upsert failed:", metricsError);
    return json({ error: "Could not store health metrics." }, 500);
  }

  const { error: analysisError } = await supabase.from("ai_analyses").upsert(
    {
      patient_id: user.id,
      report_id: reportId,
      summary: analysis.summary,
      questions: analysis.questions,
      disclaimer: DISCLAIMER,
      provider: AI_PROVIDER,
      model: AI_MODEL,
    },
    { onConflict: "report_id" },
  );
  if (analysisError) {
    console.error("[analyze-report] ai_analyses upsert failed:", analysisError);
    return json({ error: "Could not store the analysis." }, 500);
  }

  return json({
    ok: true,
    reportId,
    analysis: {
      summary: analysis.summary,
      questions: analysis.questions,
      disclaimer: DISCLAIMER,
    },
  });
});
