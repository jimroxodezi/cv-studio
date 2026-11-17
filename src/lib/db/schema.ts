import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  JobAnalysis,
  ProfileData,
  SectionKey,
  TailorResult,
} from "../profile";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    role: text("role").notNull().default("member"),
    provider: text("provider").notNull().default(""),
    model: text("model").notNull().default(""),
    openaiKey: text("openai_key").notNull().default(""),
    anthropicKey: text("anthropic_key").notNull().default(""),
    openrouterKey: text("openrouter_key").notNull().default(""),
    deepseekKey: text("deepseek_key").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(sql`lower(${table.email})`)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose").notNull().default("login"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("auth_tokens_hash_unique").on(table.tokenHash),
    index("auth_tokens_email_idx").on(sql`lower(${table.email})`),
  ],
);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("invites_email_idx").on(sql`lower(${table.email})`)],
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<ProfileData>().notNull(),
    rawDump: text("raw_dump").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("profiles_user_unique").on(table.userId)],
);

export const variants = pgTable(
  "variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    track: text("track").notNull().default("general"),
    summary: text("summary").notNull().default(""),
    sectionOrder: jsonb("section_order").$type<SectionKey[]>().notNull(),
    skillGroupIds: jsonb("skill_group_ids").$type<string[]>().notNull(),
    experienceIds: jsonb("experience_ids").$type<string[]>().notNull(),
    projectIds: jsonb("project_ids").$type<string[]>().notNull(),
    educationIds: jsonb("education_ids").$type<string[]>().notNull(),
    options: jsonb("options")
      .$type<{ pageTarget: 1 | 2; showSummary: boolean; showSkills: boolean }>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("variants_user_idx").on(table.userId)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => variants.id, { onDelete: "set null" }),
    company: text("company").notNull().default(""),
    role: text("role").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    description: text("description").notNull().default(""),
    notes: text("notes").notNull().default(""),
    status: text("status").notNull().default("draft"),
    analysis: jsonb("analysis").$type<JobAnalysis>(),
    result: jsonb("result").$type<TailorResult>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("jobs_user_idx").on(table.userId)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => variants.id, { onDelete: "set null" }),
    kind: text("kind").notNull().default("variant"),
    label: text("label").notNull().default(""),
    latex: text("latex").notNull(),
    pdf: bytea("pdf").notNull(),
    pageCount: integer("page_count").notNull().default(0),
    atsText: text("ats_text").notNull().default(""),
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("documents_user_idx").on(table.userId),
    index("documents_job_idx").on(table.jobId),
  ],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    model: text("model").notNull().default(""),
    usedServerKey: boolean("used_server_key").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("usage_user_created_idx").on(table.userId, table.createdAt)],
);

export type UserRow = typeof users.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type VariantRow = typeof variants.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
