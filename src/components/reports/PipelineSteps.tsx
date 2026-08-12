import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

export type PipelineStage = "upload" | "ocr" | "extract" | "analyze" | "summary";

const STEPS: { id: PipelineStage; label: string; detail: string }[] = [
  { id: "upload", label: "upload", detail: "report received" },
  { id: "ocr", label: "ocr", detail: "extracting text" },
  { id: "extract", label: "extract", detail: "structuring metrics" },
  { id: "analyze", label: "analyze", detail: "ai patient summary" },
  { id: "summary", label: "summary", detail: "questions for doctor" },
];

interface PipelineStepsProps {
  /** Index of the step currently running (0-based). */
  current?: number;
  done?: boolean;
  error?: string | null;
  className?: string;
}

export function PipelineSteps({
  current = -1,
  done = false,
  error = null,
  className,
}: PipelineStepsProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card p-4 font-mono text-xs leading-6",
        className,
      )}
    >
      <p className="text-muted-foreground">
        <span className="text-ok">$</span> arogya report --analyze
        {error ? (
          <span className="text-destructive"> ✗ {error}</span>
        ) : (
          <span className="terminal-caret text-ok">▌</span>
        )}
      </p>
      <div className="mt-3 space-y-1.5">
        {STEPS.map((step, index) => {
          const isDone = done || index < current;
          const isCurrent = !done && !error && index === current;
          const isPending = !done && !error && index > current;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.12 }}
              className="flex items-center gap-2"
            >
              <span
                className={cn(
                  "inline-flex w-14 shrink-0 items-center gap-1",
                  isDone && "text-ok",
                  isCurrent && "text-foreground",
                  isPending && "text-muted-foreground/60",
                )}
              >
                {isDone ? (
                  <Check className="size-3" />
                ) : isCurrent ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <span className="inline-block size-3 rounded-full border border-border" />
                )}
                [{isDone ? "ok" : isCurrent ? "run" : "wait"}]
              </span>
              <span className="w-20 shrink-0 text-foreground">
                {String(index + 1).padStart(2, "0")}_{step.label}
              </span>
              <span
                className={cn(
                  "truncate text-muted-foreground",
                  isCurrent && "text-foreground",
                )}
              >
                {step.detail}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
