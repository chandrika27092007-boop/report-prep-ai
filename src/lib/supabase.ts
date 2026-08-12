/**
 * ArogyaOS — Medical Report Intelligence
 *
 * Client-side Supabase data layer (the module's ONLY data path).
 *
 * The module never talks to any other backend: reports, OCR text, canonical
 * health metrics, and AI analyses all live in the main ArogyaOS Supabase
 * project, scoped to the authenticated patient via RLS (auth.uid()).
 *
 * Environment (set in the project's Keys/API keys UI):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *
 * Deploy prerequisites (see supabase/):
 *   - supabase/migrations/0001_report_intelligence.sql
 *   - supabase/functions/analyze-report (secrets: SUPABASE_URL,
 *     SUPABASE_ANON_KEY, VLY_INTEGRATION_KEY)
 */

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { HealthMetricsByKey } from "./health-metrics";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env
  .VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "SUPABASE_NOT_CONFIGURED: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the project Keys tab, then apply supabase/migrations/0001_report_intelligence.sql.",
    );
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

/* ------------------------------------------------------------------ */
/* Row types (mirror supabase/migrations/0001_report_intelligence.sql) */
/* ------------------------------------------------------------------ */

export interface ReportRow {
  id: string;
  patient_id: string;
  file_name: string;
  file_type: string;
  source_type: "pdf" | "image";
  file_size: number;
  storage_path: string | null;
  ocr_text: string;
  status: "processing" | "done" | "failed";
  error: string | null;
  created_at: string;
}

export interface HealthMetricsRow {
  id: string;
  patient_id: string;
  report_id: string;
  metrics: HealthMetricsByKey;
  signature: string;
  source_text_length: number;
  created_at: string;
}

export interface AiAnalysisRow {
  id: string;
  patient_id: string;
  report_id: string;
  summary: string;
  questions: string[];
  disclaimer: string;
  provider: string;
  model: string;
  created_at: string;
}

export interface ReportListItem {
  id: string;
  file_name: string;
  file_type: string;
  source_type: "pdf" | "image";
  file_size: number;
  status: ReportRow["status"];
  error: string | null;
  created_at: string;
  metricsFound: number;
  metricsFlagged: number;
}

export interface ReportBundle {
  report: ReportRow;
  metrics: HealthMetricsByKey | null;
  metricsSignature: string | null;
  analysis: AiAnalysisRow | null;
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export async function getSessionUser(): Promise<User | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.user ?? null;
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

function countMetrics(metrics: HealthMetricsByKey | null | undefined): {
  found: number;
  flagged: number;
} {
  if (!metrics) return { found: 0, flagged: 0 };
  const entries = Object.values(metrics);
  return {
    found: entries.filter((m) => m.status !== "not_found").length,
    flagged: entries.filter((m) => m.status === "out_of_range").length,
  };
}

export async function listReports(): Promise<ReportListItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reports")
    .select("*, health_metrics(metrics)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row) => {
    const embedded = Array.isArray(row.health_metrics)
      ? (row.health_metrics[0]?.metrics as HealthMetricsByKey | undefined)
      : undefined;
    const counts = countMetrics(embedded);
    return {
      id: row.id,
      file_name: row.file_name,
      file_type: row.file_type,
      source_type: row.source_type,
      file_size: row.file_size,
      status: row.status,
      error: row.error ?? null,
      created_at: row.created_at,
      metricsFound: counts.found,
      metricsFlagged: counts.flagged,
    };
  });
}

export async function getReportBundle(id: string): Promise<ReportBundle | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reports")
    .select("*, health_metrics(*), ai_analyses(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const metricsDoc = Array.isArray(data.health_metrics)
    ? data.health_metrics[0]
    : (data.health_metrics as unknown as HealthMetricsRow | null);

  const analysisDoc = Array.isArray(data.ai_analyses)
    ? data.ai_analyses[0]
    : (data.ai_analyses as unknown as AiAnalysisRow | null);

  const report: ReportRow = {
    id: data.id,
    patient_id: data.patient_id,
    file_name: data.file_name,
    file_type: data.file_type,
    source_type: data.source_type,
    file_size: data.file_size,
    storage_path: data.storage_path ?? null,
    ocr_text: data.ocr_text,
    status: data.status,
    error: data.error ?? null,
    created_at: data.created_at,
  };

  return {
    report,
    metrics: (metricsDoc?.metrics as HealthMetricsByKey | undefined) ?? null,
    metricsSignature: metricsDoc?.signature ?? null,
    analysis: analysisDoc ?? null,
  };
}

/** Time-limited signed URL for the patient's own uploaded file (RLS-scoped). */
export async function getOriginalFileUrl(
  storagePath: string,
): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from("report-files")
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

/* ------------------------------------------------------------------ */
/* Upload + pipeline                                                   */
/* ------------------------------------------------------------------ */

export async function uploadReportFile(
  file: File,
  patientId: string,
): Promise<{ path: string }> {
  const supabase = getSupabase();
  const path = `${patientId}/${crypto.randomUUID()}-${file.name.replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  )}`;
  const { error } = await supabase.storage.from("report-files").upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw new Error(error.message);
  return { path };
}

export async function createReportRow(input: {
  patientId: string;
  fileName: string;
  fileType: string;
  sourceType: "pdf" | "image";
  fileSize: number;
  storagePath: string;
  ocrText: string;
}): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reports")
    .insert({
      patient_id: input.patientId,
      file_name: input.fileName,
      file_type: input.fileType,
      source_type: input.sourceType,
      file_size: input.fileSize,
      storage_path: input.storagePath,
      ocr_text: input.ocrText,
      status: "processing",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

/**
 * Kicks off server-side AI analysis (Supabase edge function). The function
 * verifies the caller's JWT, re-validates the extracted metrics, and persists
 * health_metrics + ai_analyses. Throws a readable error on failure.
 */
export async function analyzeReport(input: {
  reportId: string;
  ocrText: string;
  metrics: HealthMetricsByKey;
}): Promise<void> {
  const supabase = getSupabase();
  const token = await getAccessToken();
  if (!token) {
    throw new Error("You must be signed in to analyze a report.");
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/analyze-report`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reportId: input.reportId,
        ocrText: input.ocrText,
        metrics: input.metrics,
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.error ??
        `Analysis failed (HTTP ${response.status}). Please try again.`,
    );
  }
}

/** Mark a stuck/failed report as failed (best effort, e.g. analysis errors). */
export async function markReportFailed(reportId: string, message: string) {
  const supabase = getSupabase();
  await supabase
    .from("reports")
    .update({ status: "failed", error: message.slice(0, 500) })
    .eq("id", reportId);
}
