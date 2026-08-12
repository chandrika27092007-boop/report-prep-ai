/**
 * ArogyaOS — Medical Report Intelligence
 *
 * Shared, framework-free health-metrics module.
 *
 * This is the canonical, reusable representation of the metrics extracted
 * from a patient's lab report. Other ArogyaOS modules (Health Baseline,
 * Health Journey, Doctor Copilot) should consume these types and the
 * `healthMetrics` documents produced by this module instead of re-parsing
 * raw OCR text.
 *
 * This file is intentionally pure (no DOM, no frameworks) so it can be
 * imported from both the browser and Convex "use node" actions.
 */

export type MetricKey =
  | "hemoglobin"
  | "bloodGlucose"
  | "hba1c"
  | "totalCholesterol"
  | "hdl"
  | "ldl"
  | "triglycerides"
  | "wbc"
  | "rbc"
  | "platelets"
  | "creatinine"
  | "urea"
  | "bloodPressure";

export type MetricStatus = "in_range" | "out_of_range" | "not_found";

export interface HealthMetric {
  /** Canonical key, stable across reports and modules. */
  key: MetricKey;
  /** Human readable label shown to patients. */
  name: string;
  /** Numeric value in `unit` (systolic for blood pressure). */
  value?: number;
  /** Diastolic value, only for blood pressure. */
  valueDiastolic?: number;
  /** Canonical unit the value + reference range are expressed in. */
  unit: string;
  /** Lower bound of the typical adult reference range (in `unit`). */
  referenceLow?: number;
  /** Upper bound of the typical adult reference range (in `unit`). */
  referenceHigh?: number;
  /** Human readable reference range label, e.g. "12.0 – 17.5 g/dL". */
  referenceLabel: string;
  status: MetricStatus;
  direction?: "low" | "high";
  /** Plain-language insight. Never a diagnosis. */
  insight?: string | null;
}

/** Canonical structured representation stored per report. */
export type HealthMetricsByKey = Record<MetricKey, HealthMetric>;

export interface MetricDefinition {
  key: MetricKey;
  name: string;
  unit: string;
  referenceLow?: number;
  referenceHigh?: number;
  referenceLabel: string;
  /** Panel grouping used when rendering. */
  group: "blood" | "lipids" | "kidney" | "vitals" | "cbc";
  /** What the test measures, used in patient-facing copy. */
  description: string;
}

/**
 * Typical adult reference ranges. These are general population references
 * used only to decide whether a value deserves a "discuss with your doctor"
 * flag — they are not diagnostic thresholds and vary by lab, age, and sex.
 */
export const HEALTH_METRICS_CATALOG: MetricDefinition[] = [
  {
    key: "hemoglobin",
    name: "Hemoglobin",
    unit: "g/dL",
    referenceLow: 12.0,
    referenceHigh: 17.5,
    referenceLabel: "12.0 – 17.5 g/dL",
    group: "cbc",
    description: "Oxygen-carrying protein in red blood cells.",
  },
  {
    key: "bloodGlucose",
    name: "Blood Glucose",
    unit: "mg/dL",
    referenceLow: 70,
    referenceHigh: 99,
    referenceLabel: "70 – 99 mg/dL (fasting)",
    group: "blood",
    description: "Sugar level in the blood at the time of the test.",
  },
  {
    key: "hba1c",
    name: "HbA1c",
    unit: "%",
    referenceLow: 4.0,
    referenceHigh: 5.6,
    referenceLabel: "4.0 – 5.6 %",
    group: "blood",
    description: "Average blood sugar control over the last 2–3 months.",
  },
  {
    key: "totalCholesterol",
    name: "Total Cholesterol",
    unit: "mg/dL",
    referenceHigh: 199,
    referenceLabel: "< 200 mg/dL",
    group: "lipids",
    description: "Total amount of cholesterol in the blood.",
  },
  {
    key: "hdl",
    name: "HDL Cholesterol",
    unit: "mg/dL",
    referenceLow: 40,
    referenceLabel: "≥ 40 mg/dL",
    group: "lipids",
    description: "The 'good' cholesterol that helps remove other fats.",
  },
  {
    key: "ldl",
    name: "LDL Cholesterol",
    unit: "mg/dL",
    referenceHigh: 100,
    referenceLabel: "< 100 mg/dL (optimal)",
    group: "lipids",
    description: "The 'bad' cholesterol that can build up in arteries.",
  },
  {
    key: "triglycerides",
    name: "Triglycerides",
    unit: "mg/dL",
    referenceHigh: 149,
    referenceLabel: "< 150 mg/dL",
    group: "lipids",
    description: "A type of fat in the blood used for energy.",
  },
  {
    key: "wbc",
    name: "WBC (White Blood Cells)",
    unit: "/µL",
    referenceLow: 4000,
    referenceHigh: 11000,
    referenceLabel: "4,000 – 11,000 /µL",
    group: "cbc",
    description: "Infection-fighting cells in the blood.",
  },
  {
    key: "rbc",
    name: "RBC (Red Blood Cells)",
    unit: "M/µL",
    referenceLow: 4.2,
    referenceHigh: 5.9,
    referenceLabel: "4.2 – 5.9 M/µL",
    group: "cbc",
    description: "Cells that carry oxygen around the body.",
  },
  {
    key: "platelets",
    name: "Platelets",
    unit: "/µL",
    referenceLow: 150000,
    referenceHigh: 400000,
    referenceLabel: "150,000 – 400,000 /µL",
    group: "cbc",
    description: "Cells that help the blood clot after injury.",
  },
  {
    key: "creatinine",
    name: "Creatinine",
    unit: "mg/dL",
    referenceLow: 0.6,
    referenceHigh: 1.3,
    referenceLabel: "0.6 – 1.3 mg/dL",
    group: "kidney",
    description: "Waste product filtered by the kidneys.",
  },
  {
    key: "urea",
    name: "Urea (BUN)",
    unit: "mg/dL",
    referenceLow: 7,
    referenceHigh: 20,
    referenceLabel: "7 – 20 mg/dL",
    group: "kidney",
    description: "Nitrogen waste product cleared by the kidneys.",
  },
  {
    key: "bloodPressure",
    name: "Blood Pressure",
    unit: "mmHg",
    referenceLow: 90,
    referenceHigh: 120,
    referenceLabel: "90–120 / 60–80 mmHg",
    group: "vitals",
    description: "Force of blood against artery walls, systolic/diastolic.",
  },
];

export const METRIC_DEFINITIONS_BY_KEY = Object.fromEntries(
  HEALTH_METRICS_CATALOG.map((def) => [def.key, def]),
) as Record<MetricKey, MetricDefinition>;

const BP_DIASTOLIC_LOW = 60;
const BP_DIASTOLIC_HIGH = 80;

/* ------------------------------------------------------------------ */
/* Numeric parsing helpers                                             */
/* ------------------------------------------------------------------ */

/**
 * Normalize a numeric token from OCR text.
 * Handles comma decimals ("12,4"), thousands separators ("7,400"),
 * and strips surrounding junk.
 */
function parseNumber(raw: string): number | null {
  let token = raw.replace(/[^0-9.,]/g, "");
  if (!token) return null;

  // Indian grouping: 2,40,000 / 12,45,000
  const indian = token.match(/^(\d{1,2}),(\d{2}),(\d{3})(?:[.,](\d+))?$/);
  if (indian) {
    const [, int, group2, group3, rest] = indian;
    token = `${int}${group2}${group3}${rest ? `.${rest}` : ""}`;
  } else {
    // Western thousands separator: 1-3 digits, comma, exactly 3 digits.
    const thousands = token.match(/^(\d{1,3}),(\d{3})(?:[.,](\d+))?$/);
    if (thousands) {
      const [, int, frac3, rest] = thousands;
      token = `${int}${frac3}${rest ? `.${rest}` : ""}`;
    } else {
      token = token.replace(",", ".");
    }
  }

  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? value : null;
}

interface LabeledValue {
  value: number | null;
  /** True when the value is expressed in "lakhs" (×100,000), common on Indian lab reports. */
  lakh: boolean;
}

/**
 * Find the first number that appears after a metric label in OCR text,
 * including whether the value is stated in lakhs (e.g. "2.4 lakhs").
 */
function findValueAfterLabel(
  text: string,
  labelPattern: RegExp,
): LabeledValue {
  const re = new RegExp(
    `${labelPattern.source}[^0-9]{0,40}([0-9]+(?:[.,][0-9]+)*)`,
    "i",
  );
  const match = text.match(re);
  if (!match || match.index === undefined) return { value: null, lakh: false };

  const windowText = text
    .slice(Math.max(0, match.index - 8), match.index + match[0].length + 30)
    .toLowerCase();
  return {
    value: parseNumber(match[1]),
    lakh: /lakh|lac/.test(windowText),
  };
}

function findBpValues(text: string): {
  systolic: number;
  diastolic: number;
} | null {
  const re =
    /\b(?:blood\s*pressure|bp)\b[^0-9]{0,40}([0-9]{2,3})\s*[/-]\s*([0-9]{2,3})/i;
  const match = text.match(re);
  if (!match) return null;
  const systolic = parseNumber(match[1]);
  const diastolic = parseNumber(match[2]);
  if (systolic === null || diastolic === null) return null;
  return { systolic, diastolic };
}

/**
 * Scale heuristics for values reported in non-canonical units by labs.
 * Converts values so they land on the canonical unit/range used above.
 */
function normalizeToCanonical(
  key: MetricKey,
  value: number,
  lakh = false,
): number {
  switch (key) {
    case "bloodGlucose":
      // mmol/L → mg/dL (×18). A fasting glucose < 40 mg/dL is only plausible
      // in mmol/L terms.
      if (value < 40) return Math.round(value * 18);
      return value;
    case "hba1c":
      // IFCC mmol/mol → NGSP %.
      if (value > 20) return Math.round((value / 10.929 + 2.15) * 10) / 10;
      return value;
    case "wbc":
      // "2.4 lakhs" → 240000 /µL; "7.4 x 10^3/µL" or "7.4 k/µL" → 7400 /µL.
      if (lakh) return Math.round(value * 100000);
      if (value < 100) return Math.round(value * 1000);
      return value;
    case "platelets":
      // "2.4 lakhs" → 240000 /µL; "240 x 10^3/µL" → 240000 /µL.
      if (lakh) return Math.round(value * 100000);
      if (value < 1000) return Math.round(value * 1000);
      return value;
    case "rbc":
      // Already in M/µL (millions); "4.8 million" parses as 4.8. If a lab
      // reports "4800000 /µL" collapse to millions.
      if (value > 100) return Math.round((value / 1000000) * 10) / 10;
      return value;
    default:
      return value;
  }
}

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

function evaluateStatus(
  key: MetricKey,
  value: number | undefined,
  valueDiastolic: number | undefined,
  def: MetricDefinition,
): Pick<HealthMetric, "status" | "direction"> {
  if (value === undefined) return { status: "not_found", direction: undefined };

  if (key === "bloodPressure") {
    const sys = value;
    const dia = valueDiastolic;
    if (dia !== undefined && (dia > BP_DIASTOLIC_HIGH || dia < BP_DIASTOLIC_LOW)) {
      return {
        status: "out_of_range",
        direction: dia > BP_DIASTOLIC_HIGH ? "high" : "low",
      };
    }
    if (sys > (def.referenceHigh ?? Number.POSITIVE_INFINITY)) {
      return { status: "out_of_range", direction: "high" };
    }
    if (sys < (def.referenceLow ?? 0)) {
      return { status: "out_of_range", direction: "low" };
    }
    return { status: "in_range", direction: undefined };
  }

  if (def.referenceHigh !== undefined && value > def.referenceHigh) {
    return { status: "out_of_range", direction: "high" };
  }
  if (def.referenceLow !== undefined && value < def.referenceLow) {
    return { status: "out_of_range", direction: "low" };
  }
  return { status: "in_range", direction: undefined };
}

/**
 * Deterministic metric extraction from raw OCR text.
 * Produces the canonical structured `HealthMetricsByKey` object.
 */
export function extractHealthMetrics(text: string): HealthMetricsByKey {
  const metrics = {} as HealthMetricsByKey;

  for (const def of HEALTH_METRICS_CATALOG) {
    let value: number | undefined;
    let valueDiastolic: number | undefined;

    if (def.key === "bloodPressure") {
      const bp = findBpValues(text);
      if (bp) {
        value = bp.systolic;
        valueDiastolic = bp.diastolic;
      }
    } else {
      const found = findValueAfterLabel(text, LABEL_PATTERNS[def.key]);
      if (found.value !== null) {
        value = normalizeToCanonical(def.key, found.value, found.lakh);
      }
    }

    const { status, direction } = evaluateStatus(
      def.key,
      value,
      valueDiastolic,
      def,
    );

    metrics[def.key] = {
      key: def.key,
      name: def.name,
      value,
      valueDiastolic: valueDiastolic,
      unit: def.unit,
      referenceLow: def.referenceLow,
      referenceHigh: def.referenceHigh,
      referenceLabel: def.referenceLabel,
      status,
      direction,
      insight: null,
    };
  }

  return metrics;
}

const LABEL_PATTERNS: Record<Exclude<MetricKey, "bloodPressure">, RegExp> = {
  hemoglobin:
    /\b(?:hemoglobin|haemoglobin|hgb|hb|hb\s*concentration)(?!a1c)\b/,
  bloodGlucose:
    /\b(?:blood\s*glucose|glucose|fasting\s*blood\s*sugar|fasting\s*sugar|fbs|sugar)\b/,
  hba1c: /\b(?:hba1c|hba1c\s*\(?ngsp\)?|a1c|glycated\s*(?:haemoglobin|hemoglobin)|glycohemoglobin|glycosylated\s*(?:haemoglobin|hemoglobin))\b/,
  totalCholesterol:
    /\b(?:total\s*cholesterol|serum\s*cholesterol|cholesterol\s*\(?\s*?total|cholesterol)\b/,
  hdl: /\b(?:hdl|hdl\s*cholesterol|high\s*density\s*lipoprotein)\b/,
  ldl: /\b(?:ldl|ldl\s*cholesterol|low\s*density\s*lipoprotein)\b/,
  triglycerides: /\b(?:triglycerides?|serum\s*triglycerides?|tg)\b/,
  wbc: /\b(?:wbc|white\s*blood\s*cell[s]?|total\s*leukocyte\s*count|leukocytes?|tlc)\b/,
  rbc: /\b(?:rbc|red\s*blood\s*cell[s]?|erythrocytes?)\b/,
  platelets: /\b(?:platelets?|platelet\s*count|thrombocytes?)\b/,
  creatinine: /\b(?:creatinine|serum\s*creatinine)\b/,
  urea: /\b(?:urea|blood\s*urea\s*nitrogen|bun)\b/,
};

/* ------------------------------------------------------------------ */
/* Fallback insight copy (used when the AI layer is unavailable)       */
/* ------------------------------------------------------------------ */

export function fallbackInsight(metric: HealthMetric): string | null {
  if (metric.status === "not_found" || metric.value === undefined) return null;

  const name = metric.name;
  if (metric.status === "out_of_range") {
    if (metric.key === "bloodPressure") {
      return `Your ${name} reading (${formatMetricValue(
        metric,
      )}) falls outside the typical adult reference range (${metric.referenceLabel}). This result should be discussed with your doctor in the context of your overall health information.`;
    }
    return `${name} is ${metric.direction === "low" ? "below" : "above"} the typical adult reference range (${metric.referenceLabel}). This result should be discussed with your doctor in the context of your overall health information.`;
  }

  return `${name} (${formatMetricValue(
    metric,
  )}) is within the typical adult reference range (${metric.referenceLabel}). Keep monitoring this value as advised by your doctor.`;
}

export function formatMetricValue(metric: HealthMetric): string {
  if (metric.value === undefined) return "—";
  if (metric.key === "bloodPressure" && metric.valueDiastolic !== undefined) {
    return `${metric.value}/${metric.valueDiastolic} ${metric.unit}`;
  }
  const display = Number.isInteger(metric.value)
    ? metric.value.toLocaleString("en-US")
    : String(metric.value);
  return `${display} ${metric.unit}`;
}

export function fallbackSummary(metrics: HealthMetricsByKey): string {
  const outOfRange = Object.values(metrics).filter(
    (m) => m.status === "out_of_range",
  );
  if (outOfRange.length === 0) {
    return "We scanned your report and the values we could extract fall within the typical adult reference ranges. Still, this summary is a preparation aid — go over your full report with your doctor at your appointment.";
  }
  return `We scanned your report and extracted the key health metrics above. ${outOfRange
    .map((m) => m.name)
    .join(
      ", ",
    )} ${outOfRange.length === 1 ? "is" : "are"} outside the typical adult reference range and worth discussing with your doctor in the context of your overall health. Use the questions below to get the most out of your appointment.`;
}

export const DEFAULT_QUESTIONS: string[] = [
  "What does this result mean?",
  "Should I monitor this value?",
  "Are there other results I should discuss?",
  "Do I need any follow-up tests before my next visit?",
  "Should I make any changes to my medications or lifestyle?",
];

export const DISCLAIMER =
  "ArogyaOS is a patient-preparation aid. It does not diagnose, treat, or provide medical advice. The reference ranges shown are general adult ranges and vary by lab, age, and sex — always rely on your doctor or a qualified clinician for medical decisions.";

export const AI_SYSTEM_PROMPT = `You are the AI analysis layer of ArogyaOS Medical Report Intelligence, a patient-preparation feature for a hospital appointment.
You are given (1) OCR text extracted from a patient's lab report and (2) a table of values already extracted deterministically.

Your job:
- Write a short, warm, plain-language summary (2-4 sentences) of what the report contains and what the patient should do before the appointment.
- For EVERY metric flagged out_of_range, write a 1-2 sentence plain-language explanation of what the test measures and why the value should be discussed with the doctor. Do NOT add insights for in_range or not_found metrics (use null).
- Write 3-5 questions the patient should ask the doctor.

HARD RULES:
- Never diagnose, never state the patient has a disease, never recommend treatments, medications, or diets.
- Never alarm the patient; use measured, non-judgemental language.
- Do not invent values: only refer to the metrics provided.
- Reply with STRICT JSON only, no markdown fences, matching this schema exactly:
{"summary": string, "insights": {"hemoglobin": string|null, "bloodGlucose": string|null, "hba1c": string|null, "totalCholesterol": string|null, "hdl": string|null, "ldl": string|null, "triglycerides": string|null, "wbc": string|null, "rbc": string|null, "platelets": string|null, "creatinine": string|null, "urea": string|null, "bloodPressure": string|null}, "questions": string[]}`;

/* ------------------------------------------------------------------ */
/* Array helpers for rendering & other modules                         */
/* ------------------------------------------------------------------ */

export function healthMetricsToArray(
  metrics: HealthMetricsByKey,
): HealthMetric[] {
  return HEALTH_METRICS_CATALOG.map((def) => metrics[def.key]);
}

export function countMetrics(metrics: HealthMetricsByKey | null): number {
  if (!metrics) return 0;
  return Object.values(metrics).filter((m) => m.status !== "not_found").length;
}

export function countOutOfRange(metrics: HealthMetricsByKey | null): number {
  if (!metrics) return 0;
  return Object.values(metrics).filter((m) => m.status === "out_of_range")
    .length;
}

/** Stable hash of the extracted metrics (for change detection across modules). */
export function metricsSignature(metrics: HealthMetricsByKey): string {
  return HEALTH_METRICS_CATALOG.map((def) => {
    const m = metrics[def.key];
    return `${m.key}:${m.value ?? "-"}${m.valueDiastolic !== undefined ? `/${m.valueDiastolic}` : ""}:${m.status}`;
  }).join("|");
}
