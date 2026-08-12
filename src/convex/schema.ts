import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// -------------------------------------------------------------------
// ArogyaOS Medical Report Intelligence
//
// Canonical per-metric entry stored inside a healthMetrics document.
// The `HealthMetricsByKey` shape (one entry per metric key) is the
// reusable representation other modules (Health Baseline, Health
// Journey, Doctor Copilot) consume.
// -------------------------------------------------------------------

export const healthMetricValidator = v.object({
  key: v.string(),
  name: v.string(),
  value: v.optional(v.number()),
  valueDiastolic: v.optional(v.number()),
  unit: v.string(),
  referenceLow: v.optional(v.number()),
  referenceHigh: v.optional(v.number()),
  referenceLabel: v.string(),
  status: v.union(
    v.literal("in_range"),
    v.literal("out_of_range"),
    v.literal("not_found"),
  ),
  direction: v.optional(v.union(v.literal("low"), v.literal("high"))),
  insight: v.optional(v.union(v.string(), v.null())),
});

export const healthMetricsValidator = v.object({
  hemoglobin: healthMetricValidator,
  bloodGlucose: healthMetricValidator,
  hba1c: healthMetricValidator,
  totalCholesterol: healthMetricValidator,
  hdl: healthMetricValidator,
  ldl: healthMetricValidator,
  triglycerides: healthMetricValidator,
  wbc: healthMetricValidator,
  rbc: healthMetricValidator,
  platelets: healthMetricValidator,
  creatinine: healthMetricValidator,
  urea: healthMetricValidator,
  bloodPressure: healthMetricValidator,
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ArogyaOS Medical Report Intelligence

    // One row per uploaded lab report.
    reports: defineTable({
      userId: v.id("users"),
      fileName: v.string(),
      fileType: v.string(), // mime type
      sourceType: v.union(v.literal("pdf"), v.literal("image")),
      fileSize: v.number(), // bytes
      storageId: v.optional(v.id("_storage")), // original file in Convex storage
      ocrText: v.string(), // raw OCR extracted text
      status: v.union(v.literal("done"), v.literal("failed")),
      error: v.optional(v.string()),
      // AI analysis output (falls back to deterministic copy)
      aiSummary: v.optional(v.string()),
      questions: v.optional(v.array(v.string())),
      disclaimer: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    // One row per report holding the canonical structured metrics.
    // `metrics` uses the shared HealthMetricsByKey representation.
    healthMetrics: defineTable({
      userId: v.id("users"),
      reportId: v.id("reports"),
      metrics: healthMetricsValidator,
      sourceTextLength: v.number(),
      signature: v.string(), // stable hash for cross-module change detection
    })
      .index("by_user", ["userId"])
      .index("by_report", ["reportId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
