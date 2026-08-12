import { Badge } from "@/components/ui/badge";
import {
  HEALTH_METRICS_CATALOG,
  countMetrics,
  countOutOfRange,
  formatMetricValue,
  healthMetricsToArray,
  type HealthMetric,
  type HealthMetricsByKey,
} from "@/lib/health-metrics";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

const GROUP_LABELS: Record<string, string> = {
  cbc: "01 · blood count",
  blood: "02 · glucose / metabolic",
  lipids: "03 · lipid panel",
  kidney: "04 · kidney function",
  vitals: "05 · vitals",
};

function StatusChip({ metric }: { metric: HealthMetric }) {
  if (metric.status === "not_found") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-border" />
        not found
      </span>
    );
  }
  if (metric.status === "out_of_range") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warn">
        <span className="size-1.5 animate-pulse rounded-full bg-warn" />
        {metric.direction === "low" ? "below range" : "above range"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ok">
      <span className="size-1.5 rounded-full bg-ok" />
      in range
    </span>
  );
}

export function MetricsPanel({
  metrics,
}: {
  metrics: HealthMetricsByKey | null;
}) {
  const list = metrics ? healthMetricsToArray(metrics) : [];
  const found = metrics ? countMetrics(metrics) : 0;
  const flagged = metrics ? countOutOfRange(metrics) : 0;

  const groups = HEALTH_METRICS_CATALOG.reduce<
    Record<string, HealthMetric[]>
  >((acc, def) => {
    const metric = metrics?.[def.key];
    if (!metric) return acc;
    (acc[def.group] ??= []).push(metric);
    return acc;
  }, {});

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/50 px-4 py-2.5 font-mono text-xs">
        <span className="text-foreground">$ metrics.parse --structured</span>
        <span className="flex items-center gap-3 text-muted-foreground">
          <span>
            found <span className="text-foreground">{found}/13</span>
          </span>
          {flagged > 0 ? (
            <span className="inline-flex items-center gap-1 text-warn">
              <AlertTriangle className="size-3" /> {flagged} flagged
            </span>
          ) : (
            <span className="text-ok">0 flagged</span>
          )}
        </span>
      </div>

      {Object.entries(groups).map(([group, metricList], gi) => (
        <div key={group} className="border-b border-border last:border-b-0">
          <div className="px-4 pt-3 pb-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {GROUP_LABELS[group] ?? group}
          </div>
          <div className="hidden grid-cols-[1fr_auto_auto_auto] items-center gap-x-6 px-4 py-1 font-mono text-[11px] text-muted-foreground md:grid">
            <span>parameter</span>
            <span>value</span>
            <span>reference</span>
            <span className="w-28 text-right">status</span>
          </div>
          {metricList.map((metric, mi) => {
            const abnormal = metric.status === "out_of_range";
            return (
              <motion.div
                key={metric.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.06 + mi * 0.03 }}
                className={cn(
                  "grid grid-cols-2 items-center gap-x-6 gap-y-1 border-t border-border/70 px-4 py-2.5 md:grid-cols-[1fr_auto_auto_auto]",
                  abnormal && "border-l-2 border-l-warn bg-warn/[0.045]",
                )}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {metric.name}
                  </span>
                  {abnormal && metric.insight && (
                    <span className="mt-1.5 text-xs leading-5 text-muted-foreground md:hidden">
                      {metric.insight}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-right text-sm md:text-left",
                    abnormal
                      ? "font-semibold text-warn"
                      : "font-medium text-foreground",
                  )}
                >
                  {formatMetricValue(metric)}
                </span>
                <span className="col-span-2 text-xs text-muted-foreground md:col-span-1">
                  {metric.referenceLabel}
                </span>
                <span className="text-right">
                  <StatusChip metric={metric} />
                </span>
                {abnormal && metric.insight && (
                  <p className="col-span-2 hidden text-xs leading-5 text-muted-foreground md:col-span-4 md:block">
                    <span className="mr-1 text-warn">▲</span>
                    {metric.insight}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      ))}

      {list.length === 0 && (
        <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">
          no metrics extracted
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border bg-muted/50 px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
        <Badge variant="outline" className="gap-1.5 rounded-sm font-mono">
          <span className="size-1.5 rounded-full bg-ok" /> in range
        </Badge>
        <Badge variant="outline" className="gap-1.5 rounded-sm font-mono">
          <span className="size-1.5 rounded-full bg-warn" /> discuss with doctor
        </Badge>
        <Badge variant="outline" className="gap-1.5 rounded-sm font-mono">
          <span className="size-1.5 rounded-full bg-border" /> not found
        </Badge>
        <span className="ml-auto hidden items-center gap-1 sm:flex">
          reference: typical adult ranges · vary by lab
        </span>
      </div>
    </div>
  );
}
