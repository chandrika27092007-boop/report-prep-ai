import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  Loader2,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  TerminalSquare,
} from "lucide-react";
import { Link } from "react-router";

const NAV_LINKS = [
  { href: "#pipeline", label: "how_it_works" },
  { href: "#metrics", label: "metrics" },
  { href: "#modules", label: "modules" },
];

const PIPELINE = [
  { id: "01", name: "upload", detail: "pdf or image lab report" },
  { id: "02", name: "ocr", detail: "text extracted client-side" },
  { id: "03", name: "extract", detail: "13 metrics, structured" },
  { id: "04", name: "analyze", detail: "ai patient-friendly summary" },
  { id: "05", name: "summary", detail: "questions for your doctor" },
];

const METRICS_CHIPS = [
  "hemoglobin",
  "blood_glucose",
  "hba1c",
  "total_cholesterol",
  "hdl",
  "ldl",
  "triglycerides",
  "wbc",
  "rbc",
  "platelets",
  "creatinine",
  "urea",
  "blood_pressure",
];

const MODULES = [
  {
    icon: Activity,
    name: "Health Baseline",
    detail: "latest canonical metrics anchor your personal baseline",
  },
  {
    icon: ClipboardList,
    name: "Health Journey",
    detail: "per-report series powers trends over time",
  },
  {
    icon: Stethoscope,
    name: "Doctor Copilot",
    detail: "structured values + flags ready for the consult",
  },
];

const TERMINAL_LINES = [
  { tag: "[ok]", step: "01_upload", detail: "report received", ok: true },
  { tag: "[ok]", step: "02_ocr", detail: "extracting text", ok: true },
  { tag: "[ok]", step: "03_extract", detail: "structuring metrics", ok: true },
  { tag: "[ok]", step: "04_analyze", detail: "ai patient summary", ok: true },
  { tag: "[ok]", step: "05_summary", detail: "questions for doctor", ok: true },
];

export default function Landing() {
  const { isLoading, isAuthenticated } = useAuth();
  const ctaHref = isAuthenticated ? "/reports" : "/auth?returnTo=%2Freports";
  const ctaLabel = isLoading ? (
    <>
      <Loader2 className="size-4 animate-spin" /> checking session…
    </>
  ) : isAuthenticated ? (
    <>
      open ~/reports <ArrowRight className="size-4" />
    </>
  ) : (
    <>
      analyze a report <ArrowRight className="size-4" />
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md border border-ok/50 bg-ok/10 text-ok">
              <TerminalSquare className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              arogyaos
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              :: report_intelligence
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-5 font-mono text-xs text-muted-foreground md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <Button asChild size="sm" className="ml-auto cursor-pointer md:ml-0">
            <Link to={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="bg-terminal-grid absolute inset-0 opacity-60" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <p className="font-mono text-xs text-ok">
                $ arogyaos init --module report_intelligence
              </p>
              <h1 className="mt-4 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                Know your lab report{" "}
                <span className="text-ok">before</span> your appointment.
              </h1>
              <p className="mt-4 max-w-lg font-mono text-sm leading-6 text-muted-foreground">
                Upload a PDF or a photo of your report. We OCR it, structure the
                metrics, and hand you a plain-language summary plus the right
                questions to ask your doctor — so the consult starts where you
                left off.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="cursor-pointer">
                  <Link to={ctaHref}>{ctaLabel}</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="cursor-pointer">
                  <a href="#pipeline">
                    <FileText className="size-4" /> how it works
                  </a>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-ok" /> pdf + image
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-ok" /> 13 metrics
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5 text-warn" /> never diagnoses
                </span>
              </div>
            </motion.div>

            {/* Terminal mockup */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="rounded-md border border-border bg-card shadow-sm"
            >
              <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2.5">
                <span className="size-2.5 rounded-full border border-border bg-muted" />
                <span className="size-2.5 rounded-full border border-border bg-muted" />
                <span className="size-2.5 rounded-full border border-border bg-muted" />
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                  arogyaos@freebuff: ~/reports
                </span>
              </div>
              <div className="space-y-1.5 p-4 font-mono text-[11px] leading-5 sm:text-xs">
                <p className="text-muted-foreground">
                  <span className="text-ok">$</span> arogya report --analyze{" "}
                  <span className="text-foreground">lab_report.pdf</span>
                </p>
                {TERMINAL_LINES.map((line, index) => (
                  <motion.p
                    key={line.step}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + index * 0.35 }}
                    className="flex gap-2"
                  >
                    <span className="text-ok">{line.tag}</span>
                    <span className="text-foreground">{line.step}</span>
                    <span className="truncate text-muted-foreground">
                      {line.detail}
                    </span>
                  </motion.p>
                ))}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.4 }}
                  className="pt-2 text-muted-foreground"
                >
                  <span className="text-ok">$</span> cat metrics.parse
                </motion.p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.7 }}
                  className="space-y-0.5 pt-0.5"
                >
                  <p className="flex justify-between gap-4">
                    <span>hemoglobin</span>
                    <span className="flex gap-3">
                      <span className="text-foreground">12.4 g/dL</span>
                      <span className="text-warn">▲ discuss</span>
                    </span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span>blood_glucose</span>
                    <span className="flex gap-3">
                      <span className="text-foreground">96 mg/dL</span>
                      <span className="text-ok">● in range</span>
                    </span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span>hba1c</span>
                    <span className="flex gap-3">
                      <span className="text-foreground">5.4 %</span>
                      <span className="text-ok">● in range</span>
                    </span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span>ldl</span>
                    <span className="flex gap-3">
                      <span className="text-foreground">132 mg/dL</span>
                      <span className="text-warn">▲ discuss</span>
                    </span>
                  </p>
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 3 }}
                  className="flex gap-1.5 pt-1 text-foreground"
                >
                  <Sparkles className="mt-0.5 size-3 text-ok" />
                  <span>
                    summary: 2 values worth raising with your doctor — 3
                    questions prepared.
                  </span>
                  <span className="terminal-caret text-ok">▌</span>
                </motion.p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 divide-x divide-border border-x border-border font-mono sm:grid-cols-4">
            {[
              ["13", "structured metrics"],
              ["2", "input types · pdf / image"],
              ["0", "diagnoses. ever."],
              ["3", "questions to ask the doctor"],
            ].map(([value, label]) => (
              <div key={label} className="px-4 py-5 text-center sm:py-6">
                <p className="text-xl font-bold text-ok sm:text-2xl">{value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline */}
        <section id="pipeline" className="border-b border-border py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
            >
              <p className="font-mono text-xs text-ok">$ man report_intelligence</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                One pipeline, zero guesswork
              </h2>
              <p className="mt-2 max-w-2xl font-mono text-xs leading-5 text-muted-foreground">
                Every upload runs through the same five stages. OCR happens on
                your device; metric extraction is deterministic; AI analysis is
                reviewed against a fixed safety contract.
              </p>
            </motion.div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PIPELINE.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: index * 0.08 }}
                  className="relative rounded-md border border-border bg-card p-4"
                >
                  <p className="font-mono text-[11px] text-ok">
                    {step.id}_/05
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {step.name}
                  </p>
                  <p className="mt-1 font-mono text-[11px] leading-4 text-muted-foreground">
                    {step.detail}
                  </p>
                  {index < PIPELINE.length - 1 && (
                    <ArrowRight className="absolute -right-3 top-1/2 hidden size-4 -translate-y-1/2 text-muted-foreground/50 lg:block" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Metrics */}
        <section id="metrics" className="border-b border-border py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
            >
              <p className="font-mono text-xs text-ok">$ health_metrics --list</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Extracted &amp; structured, always
              </h2>
              <p className="mt-2 max-w-2xl font-mono text-xs leading-5 text-muted-foreground">
                Wherever a value appears on your report, it lands in the same
                canonical slot — reusable by every other ArogyaOS module.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ staggerChildren: 0.04 }}
              className="mt-8 flex flex-wrap gap-2"
            >
              {METRICS_CHIPS.map((chip, index) => (
                <motion.span
                  key={chip}
                  initial={{ opacity: 0, scale: 0.92 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground"
                >
                  {chip}
                </motion.span>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Modules */}
        <section id="modules" className="border-b border-border py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
            >
              <p className="font-mono text-xs text-ok">
                $ ls ../modules · teammates&apos; modules
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Built for the rest of ArogyaOS
              </h2>
              <p className="mt-2 max-w-2xl font-mono text-xs leading-5 text-muted-foreground">
                This module owns upload → analysis. These teammates&apos;
                modules consume its output — nothing to re-parse.
              </p>
            </motion.div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {MODULES.map((mod, index) => (
                <motion.div
                  key={mod.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: index * 0.08 }}
                  className="group rounded-md border border-border bg-card p-5 transition-colors hover:border-ok/40"
                >
                  <mod.icon className="size-5 text-ok" />
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    {mod.name}
                  </p>
                  <p className="mt-1.5 font-mono text-[11px] leading-4 text-muted-foreground">
                    {mod.detail}
                  </p>
                  <p className="mt-3 font-mono text-[11px] text-ok">
                    ● consumes: health_metrics (Supabase)
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Safety */}
        <section className="border-b border-border py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-md border border-warn/40 bg-warn/[0.05] p-6 text-center sm:p-8"
            >
              <ShieldAlert className="size-6 text-warn" />
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                It prepares you. It never diagnoses you.
              </h2>
              <p className="max-w-2xl font-mono text-xs leading-6 text-muted-foreground">
                The AI is explicitly instructed not to diagnose, treat, or
                alarm. Every explanation is framed as “discuss with your
                doctor”, and the questions it prepares are for your consult.
                Your clinician is always the final word.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              className="flex flex-col items-center"
            >
              <p className="font-mono text-xs text-ok">
                $ arogya report --analyze ~/Downloads/lab_report.pdf
              </p>
              <h2 className="mt-3 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
                Walk in with answers ready.
              </h2>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="cursor-pointer">
                  <Link to={ctaHref}>{ctaLabel}</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="cursor-pointer">
                  <Link to="/auth?returnTo=%2Freports">
                    <ImageIcon className="size-4" /> create an account
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 font-mono text-xs text-muted-foreground sm:flex-row">
          <span>arogyaos@freebuff:~$ report_intelligence v1.0.0</span>
          <span className="flex items-center gap-1.5">
            arogyaos <span className="text-ok">·</span> medical report
            intelligence module
            <span className="terminal-caret text-ok">▌</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
