import { AppShell } from "@/components/AppShell";
import { PipelineSteps } from "@/components/reports/PipelineSteps";
import type { PipelineStage } from "@/components/reports/PipelineSteps";
import { extractHealthMetrics } from "@/lib/health-metrics";
import { formatBytes, extractTextFromFile, isSupportedReportFile } from "@/lib/report-ocr";
import {
  analyzeReport,
  createReportRow,
  getSessionUser,
  isSupabaseConfigured,
  listReports,
  markReportFailed,
  uploadReportFile,
} from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Database,
  FileText,
  Loader2,
  Stethoscope,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function StatusDot({ status }: { status: "done" | "processing" | "failed" }) {
  if (status === "done") return <span className="size-1.5 rounded-full bg-ok" />;
  if (status === "processing")
    return <span className="size-1.5 animate-pulse rounded-full bg-warn" />;
  return <span className="size-1.5 rounded-full bg-destructive" />;
}

function ConfigNotice() {
  return (
    <div className="rounded-md border border-warn/40 bg-warn/[0.05] p-5">
      <div className="flex gap-3">
        <Database className="mt-0.5 size-4 shrink-0 text-warn" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Supabase data layer not configured yet
          </p>
          <p className="mt-1 font-mono text-xs leading-5 text-muted-foreground">
            This module reads and writes the main ArogyaOS Supabase project.
            Add <span className="text-foreground">VITE_SUPABASE_URL</span> and{" "}
            <span className="text-foreground">VITE_SUPABASE_ANON_KEY</span> in
            the project Keys tab, apply{" "}
            <span className="text-foreground">
              supabase/migrations/0001_report_intelligence.sql
            </span>
            , and deploy the{" "}
            <span className="text-foreground">analyze-report</span> edge
            function with <span className="text-foreground">SUPABASE_URL</span>,{" "}
            <span className="text-foreground">SUPABASE_ANON_KEY</span> and{" "}
            <span className="text-foreground">VLY_INTEGRATION_KEY</span>{" "}
            secrets. Until then, no reports can be stored.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState<{
    stage: PipelineStage;
    progress: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Awaited<ReturnType<typeof listReports>> | null>(null);
  const [configOk, setConfigOk] = useState<boolean | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const configured = isSupabaseConfigured();
      setConfigOk(configured);
      if (!configured) return;
      const user = await getSessionUser();
      if (cancelled) return;
      setHasSession(Boolean(user));
      if (!user) return;
      try {
        const rows = await listReports();
        if (!cancelled) setReports(rows);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load reports.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runPipeline = useCallback(
    async (file: File) => {
      setError(null);
      if (!isSupportedReportFile(file)) {
        setError("Unsupported file. Please upload a PDF or an image (PNG/JPEG/WebP).");
        return;
      }
      if (!isSupabaseConfigured()) {
        setError("Supabase is not configured. Add the project keys first.");
        return;
      }

      const user = await getSessionUser();
      if (!user) {
        setError(
          "No ArogyaOS session found. Sign in to continue — reports are stored under your patient account.",
        );
        return;
      }

      setProcessing({ stage: "upload", progress: 100 });
      let createdReportId: string | null = null;
      try {
        // Stage 1: OCR (client side — happens exactly once per report).
        setProcessing({ stage: "ocr", progress: 2 });
        const ocr = await extractTextFromFile(file, (progress) => {
          setProcessing({ stage: "ocr", progress });
        });

        if (ocr.text.trim().length < 20) {
          throw new Error(
            "No readable text could be extracted from this file. Try a clearer scan or a text-based PDF.",
          );
        }

        // Stage 2: store the original file in the private Supabase bucket.
        setProcessing({ stage: "extract", progress: 10 });
        const { path } = await uploadReportFile(file, user.id);

        const reportId = await createReportRow({
          patientId: user.id,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          sourceType: ocr.sourceType,
          fileSize: file.size,
          storagePath: path,
          ocrText: ocr.text,
        });

        createdReportId = reportId;

        // Stage 3: deterministic metric extraction (client side).
        const metrics = extractHealthMetrics(ocr.text);

        // Stage 4: AI analysis via the Supabase edge function.
        setProcessing({ stage: "analyze", progress: 15 });
        await analyzeReport({ reportId, ocrText: ocr.text, metrics });

        toast("Report analyzed", {
          description: `${file.name} → metrics extracted, saved, and linked to your patient record.`,
        });
        navigate(`/reports/${reportId}`);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Something went wrong while processing your report.";
        console.error("[Reports] pipeline error:", caught);
        if (createdReportId) {
          await markReportFailed(createdReportId, message).catch(() => undefined);
        }
        setError(message);
        toast("Analysis failed", { description: message });
        setProcessing(null);
      }
    },
    [navigate],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void runPipeline(file);
    },
    [runPipeline],
  );

  const prepareModules = [
    {
      icon: Activity,
      name: "Health Baseline",
      detail: "reads latest health_metrics to anchor your baseline",
      ready: true,
    },
    {
      icon: ClipboardList,
      name: "Health Journey",
      detail: "consumes the health_metrics series over time",
      ready: true,
    },
    {
      icon: Stethoscope,
      name: "Doctor Copilot",
      detail: "uses structured metrics + flags for the consult",
      ready: true,
    },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            $ cd ~/reports
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Medical Report Intelligence
          </h1>
          <p className="mt-2 max-w-2xl font-mono text-xs leading-5 text-muted-foreground">
            upload → ocr → extract metrics → ai analysis → patient-friendly
            summary. Prepare for your appointment, not for a pop quiz.
          </p>
        </div>

        {configOk === false && <ConfigNotice />}
        {configOk === true && !hasSession && (
          <div className="flex gap-3 rounded-md border border-border bg-card p-5">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-ok" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Sign in to store reports under your patient record
              </p>
              <p className="mt-1 font-mono text-xs leading-5 text-muted-foreground">
                Reports are scoped to the authenticated patient and protected by
                row-level security. Sign in through the main ArogyaOS flow
                (Convex auth is used by this sandbox preview) to continue.
              </p>
            </div>
          </div>
        )}

        {processing ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full max-w-2xl"
          >
            <PipelineSteps
              current={
                processing.stage === "upload"
                  ? 0
                  : processing.stage === "ocr"
                    ? 1
                    : processing.stage === "extract"
                      ? 2
                      : 3
              }
            />
            <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
              {processing.stage === "ocr"
                ? `ocr.progress ${processing.progress}% — this can take up to a minute`
                : processing.stage === "extract"
                  ? "storing report + structuring metrics…"
                  : "ai.analyze — writing your patient summary…"}
            </p>
            <div className="mx-auto mt-4 h-1 max-w-2xl overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-ok transition-all duration-500"
                style={{ width: `${Math.max(8, processing.progress)}%` }}
              />
            </div>
          </motion.div>
        ) : (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void runPipeline(file);
                event.target.value = "";
              }}
            />
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "group flex w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 py-14 text-center transition-colors",
                dragging
                  ? "border-ok bg-ok/5"
                  : "border-border bg-card hover:border-ok/60 hover:bg-ok/[0.03]",
              )}
            >
              <span className="grid size-12 place-items-center rounded-md border border-border bg-muted/60 text-ok transition-transform group-hover:scale-105">
                <Upload className="size-6" />
              </span>
              <span className="font-mono text-sm text-foreground">
                $ drop lab_report.pdf | lab_photo.png
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                click to browse · pdf / png / jpeg / webp · stored privately in
                your patient record
              </span>
            </motion.button>
            {error && (
              <p className="mt-3 flex items-center gap-2 font-mono text-xs text-destructive">
                <X className="size-3.5" /> {error}
              </p>
            )}
          </div>
        )}

        {/* PREPARE FOR YOUR APPOINTMENT — surfaced after an appointment is
            booked; lives in this module and is embedded by the main ArogyaOS
            dashboard next to the appointment card. */}
        <section>
          <div className="mb-3">
            <h2 className="font-mono text-sm font-semibold text-foreground">
              PREPARE FOR YOUR APPOINTMENT
            </h2>
            <p className="mt-1 max-w-2xl font-mono text-xs leading-5 text-muted-foreground">
              one upload powers everything: analysis, baseline, journey, and the
              consult itself.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="group rounded-md border border-ok/40 bg-ok/[0.04] p-4 text-left transition-colors hover:border-ok"
            >
              <Upload className="size-4 text-ok" />
              <p className="mt-2 text-sm font-semibold text-foreground">
                Upload Report
              </p>
              <p className="mt-1 font-mono text-[11px] leading-4 text-muted-foreground">
                pdf / image → ocr → metrics → ai summary
              </p>
              <p className="mt-2 font-mono text-[11px] text-ok">● ready</p>
            </button>
            {prepareModules.map((mod) => (
              <div
                key={mod.name}
                className="rounded-md border border-border bg-card p-4 transition-colors hover:border-ok/40"
              >
                <mod.icon className="size-4 text-ok" />
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {mod.name}
                </p>
                <p className="mt-1 font-mono text-[11px] leading-4 text-muted-foreground">
                  {mod.detail}
                </p>
                <p className="mt-2 font-mono text-[11px] text-ok">
                  ● consumes health_metrics
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* History */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold text-foreground">
              $ ls ~/reports
            </h2>
            {reports && reports.length > 0 && (
              <span className="font-mono text-xs text-muted-foreground">
                {reports.length} report{reports.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {configOk === true && !hasSession ? (
            <div className="flex items-center gap-2 py-10 font-mono text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> waiting for ArogyaOS
              session…
            </div>
          ) : reports === null ? (
            <div className="flex items-center gap-2 py-10 font-mono text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> loading reports…
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-md border border-border bg-card px-6 py-10 text-center">
              <ClipboardList className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-3 font-mono text-sm text-foreground">
                no reports analyzed yet
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                upload a report above to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-normal">file</th>
                    <th className="px-4 py-2.5 font-normal">type</th>
                    <th className="px-4 py-2.5 font-normal">uploaded</th>
                    <th className="px-4 py-2.5 font-normal">metrics</th>
                    <th className="px-4 py-2.5 font-normal">flags</th>
                    <th className="px-4 py-2.5 text-right font-normal">
                      action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr
                      key={report.id}
                      className="cursor-pointer border-b border-border/70 transition-colors last:border-b-0 hover:bg-muted/40"
                      onClick={() => navigate(`/reports/${report.id}`)}
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 font-mono text-xs text-foreground">
                          <FileText className="size-3.5 text-muted-foreground" />
                          <span className="max-w-56 truncate">
                            {report.file_name}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {report.source_type === "pdf" ? "pdf" : "image"} ·{" "}
                        {formatBytes(report.file_size)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {new Date(report.created_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        {report.metricsFound}
                      </td>
                      <td className="px-4 py-3">
                        {report.metricsFlagged > 0 ? (
                          <span className="font-mono text-xs text-warn">
                            {report.metricsFlagged}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-ok">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1.5 font-mono text-xs">
                          <StatusDot status={report.status} />
                          <span className="text-foreground">
                            {report.status === "done"
                              ? "view"
                              : report.status === "processing"
                                ? "analyzing"
                                : "failed"}
                          </span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Reusable metrics hook — for teammate modules */}
        <section>
          <div className="mb-3">
            <h2 className="font-mono text-sm font-semibold text-foreground">
              $ health_metrics --export
            </h2>
            <p className="mt-1 max-w-2xl font-mono text-xs leading-5 text-muted-foreground">
              every report writes one canonical{" "}
              <span className="text-foreground">health_metrics</span> row in
              Supabase. Health Baseline, Health Journey and Doctor Copilot read
              that table directly — OCR runs exactly once, here.
            </p>
          </div>
          <pre className="overflow-x-auto rounded-md border border-border bg-card p-4 font-mono text-[11px] leading-5 text-muted-foreground">
{`-- shared health-data source (RLS: auth.uid() = patient_id)
select metrics, signature from health_metrics
where patient_id = auth.uid()
order by created_at desc;`}
          </pre>
        </section>
      </div>
    </AppShell>
  );
}
