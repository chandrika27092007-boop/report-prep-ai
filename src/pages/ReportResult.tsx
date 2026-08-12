import { AppShell } from "@/components/AppShell";
import { MetricsPanel } from "@/components/reports/MetricsPanel";
import { PipelineSteps } from "@/components/reports/PipelineSteps";
import { Button } from "@/components/ui/button";
import type { HealthMetricsByKey } from "@/lib/health-metrics";
import { formatBytes } from "@/lib/report-ocr";
import { getOriginalFileUrl, getReportBundle } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  HelpCircle,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

export default function ReportResult() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof getReportBundle>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showOcr, setShowOcr] = useState(false);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const result = await getReportBundle(id);
      setBundle(result);
      setLoadError(null);
    } catch (caught) {
      console.error("[ReportResult] load error:", caught);
      setBundle(null);
      setLoadError(
        caught instanceof Error ? caught.message : "Could not load this report.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // While the edge function is still analyzing, poll until it finishes.
  useEffect(() => {
    if (bundle?.report.status !== "processing") return;
    const timer = window.setInterval(() => {
      void load();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [bundle?.report.status, load]);

  // Resolve the signed URL for the original file once.
  useEffect(() => {
    let cancelled = false;
    if (bundle?.report.storage_path) {
      void getOriginalFileUrl(bundle.report.storage_path).then((url) => {
        if (!cancelled) setOriginalUrl(url);
      });
    } else {
      setOriginalUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [bundle?.report.storage_path]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 py-20 font-mono text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> loading report…
        </div>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg rounded-md border border-border bg-card px-6 py-14 text-center">
          <p className="font-mono text-sm text-foreground">report_load_error ✗</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">{loadError}</p>
          <Button
            type="button"
            className="mt-6 cursor-pointer"
            onClick={() => navigate("/reports")}
          >
            ← back to ~/reports
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!bundle) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg rounded-md border border-border bg-card px-6 py-14 text-center">
          <p className="font-mono text-sm text-foreground">report_not_found ✗</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            This report doesn&apos;t exist or belongs to another account.
          </p>
          <Button
            type="button"
            className="mt-6 cursor-pointer"
            onClick={() => navigate("/reports")}
          >
            ← back to ~/reports
          </Button>
        </div>
      </AppShell>
    );
  }

  const { report, metrics, analysis } = bundle;
  const metricsByKey = (metrics ?? null) as HealthMetricsByKey | null;
  const shortId = report.id.slice(0, 8);
  const uploadedAt = new Date(report.created_at);

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        {/* Breadcrumb + header */}
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            $ cd ~/reports/{shortId}
          </p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
                <FileText className="size-5 text-ok" />
                {report.file_name}
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {report.source_type === "pdf" ? "pdf" : "image"} ·{" "}
                {formatBytes(report.file_size)} ·{" "}
                {uploadedAt.toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {originalUrl && (
                <Button variant="outline" size="sm" asChild className="cursor-pointer">
                  <a href={originalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" /> original file
                  </a>
                </Button>
              )}
              <Button size="sm" asChild className="cursor-pointer">
                <Link to="/reports">analyze another</Link>
              </Button>
            </div>
          </div>
        </div>

        {report.status === "processing" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full max-w-2xl"
          >
            <PipelineSteps current={3} />
            <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
              ai.analyze — writing your patient summary… this can take up to a
              minute
            </p>
            <div className="mx-auto mt-4 h-1 max-w-2xl overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-ok" />
            </div>
          </motion.div>
        ) : report.status === "failed" ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/[0.04] p-5">
            <p className="font-mono text-sm font-semibold text-foreground">
              report_analysis_failed ✗
            </p>
            <p className="mt-1 font-mono text-xs leading-5 text-muted-foreground">
              {report.error ?? "Something went wrong while analyzing this report."}
            </p>
            <Button
              type="button"
              className="mt-4 cursor-pointer"
              onClick={() => navigate("/reports")}
            >
              ← back to ~/reports
            </Button>
          </div>
        ) : (
          <>
            {/* Pipeline */}
            <PipelineSteps done />

            <div className="grid gap-6 lg:grid-cols-2">
              {/* 1 + 2: Report uploaded */}
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2 border-b border-border pb-2.5 font-mono text-xs">
                  <CheckCircle2 className="size-4 text-ok" />
                  <span className="font-semibold text-foreground">
                    report.uploaded
                  </span>
                  <span className="ml-auto text-ok">[ok]</span>
                </div>
                <dl className="mt-3 space-y-2 font-mono text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">file</dt>
                    <dd className="truncate text-foreground">{report.file_name}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">type</dt>
                    <dd className="uppercase text-foreground">{report.source_type}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">size</dt>
                    <dd className="text-foreground">{formatBytes(report.file_size)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">uploaded</dt>
                    <dd className="text-foreground">
                      {uploadedAt.toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">ocr</dt>
                    <dd className="text-foreground">
                      {report.ocr_text.length.toLocaleString()} chars extracted
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => setShowOcr((v) => !v)}
                  className="mt-4 flex w-full items-center justify-between rounded border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground transition-colors hover:border-ok/50"
                >
                  <span>
                    $ cat ocr.extracted_text{" "}
                    <span className="text-muted-foreground">
                      ({report.ocr_text.length} chars)
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      showOcr && "rotate-180",
                    )}
                  />
                </button>
                {showOcr && (
                  <pre className="mt-2 max-h-72 overflow-auto rounded border border-border bg-background p-3 font-mono text-[11px] leading-5 text-foreground/90">
                    {report.ocr_text}
                  </pre>
                )}
              </motion.section>

              {/* 5: AI summary + questions */}
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="flex flex-col gap-6"
              >
                <div className="rounded-md border border-ok/30 bg-ok/[0.04] p-4">
                  <div className="flex items-center gap-2 border-b border-ok/20 pb-2.5 font-mono text-xs">
                    <Sparkles className="size-4 text-ok" />
                    <span className="font-semibold text-foreground">ai.explain</span>
                    <span className="ml-auto text-ok">[ok]</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    {analysis?.summary ??
                      "Your report was scanned and the key values were extracted. Discuss any flagged values with your doctor at your appointment."}
                  </p>
                </div>

                <div className="rounded-md border border-border bg-card p-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2.5 font-mono text-xs">
                    <HelpCircle className="size-4 text-warn" />
                    <span className="font-semibold text-foreground">ask.these</span>
                    <span className="ml-auto text-muted-foreground">
                      {analysis?.questions.length ?? 0} questions
                    </span>
                  </div>
                  <ol className="mt-3 space-y-2.5">
                    {(analysis?.questions ?? []).map((question, index) => (
                      <li key={index} className="flex gap-3 text-sm leading-6">
                        <span className="shrink-0 font-mono text-xs text-warn">
                          {String(index + 1).padStart(2, "0")}.
                        </span>
                        <span className="text-foreground">{question}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </motion.section>
            </div>

            {/* 3 + 4: extracted metrics + abnormal indicators */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
            >
              <div className="mb-3 font-mono text-sm font-semibold text-foreground">
                $ metrics.parse --structured
              </div>
              <MetricsPanel metrics={metricsByKey} />
            </motion.section>

            {/* Disclaimer */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex gap-3 rounded-md border border-warn/40 bg-warn/[0.05] p-4"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
              <div>
                <p className="font-mono text-xs font-semibold text-foreground">
                  important disclaimer
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {analysis?.disclaimer ??
                    "ArogyaOS is a patient-preparation aid. It does not diagnose, treat, or provide medical advice — always rely on your doctor or a qualified clinician for medical decisions."}
                </p>
              </div>
            </motion.section>
          </>
        )}
      </div>
    </AppShell>
  );
}
