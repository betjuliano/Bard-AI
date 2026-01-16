import { sql, relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Admin email (hidden from public queries)
export const ADMIN_EMAIL = "admjulianoo@gmail.com";

// Users table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  fullName: varchar("full_name"),
  cpf: varchar("cpf").unique(),
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  freeTranscriptionUsed: boolean("free_transcription_used").default(false),
  freeAnalysisUsed: boolean("free_analysis_used").default(false),
  credits: integer("credits").default(0),
  isAdmin: boolean("is_admin").default(false),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  transcriptions: many(transcriptions),
  analyses: many(analyses),
  payments: many(payments),
  accessLogs: many(userAccessLogs),
  creditTransactions: many(creditTransactions),
}));

// Transcription segment type for timestamps
export type TranscriptionSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
};

// Transcription chunk progress type
export type TranscriptionChunkProgress = {
  chunkIndex: number;
  totalChunks: number;
  status: "pending" | "processing" | "completed" | "error";
  text?: string;
  segments?: TranscriptionSegment[];
  startOffset: number;
  error?: string;
};

// Transcriptions table
export const transcriptions = pgTable("transcriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: varchar("title").notNull(),
  originalFileName: varchar("original_file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  duration: integer("duration"),
  transcriptionText: text("transcription_text"),
  segments: jsonb("segments").$type<TranscriptionSegment[]>(),
  wordCount: integer("word_count"),
  pageCount: integer("page_count"),
  status: varchar("status").notNull().default("pending"),
  isPremiumQuality: boolean("is_premium_quality").default(false),
  totalChunks: integer("total_chunks"),
  completedChunks: integer("completed_chunks").default(0),
  chunkProgress: jsonb("chunk_progress").$type<TranscriptionChunkProgress[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const transcriptionsRelations = relations(transcriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [transcriptions.userId],
    references: [users.id],
  }),
  analyses: many(analyses),
}));

// Analyses table (Bardin qualitative analysis)
export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  transcriptionId: integer("transcription_id").references(() => transcriptions.id),
  title: varchar("title").notNull(),
  inputText: text("input_text"),
  inputTextPages: integer("input_text_pages"),
  theoreticalFramework: text("theoretical_framework"),
  theoreticalFrameworkFileName: varchar("theoretical_framework_file_name"),
  theoreticalFrameworkPages: integer("theoretical_framework_pages"),
  isFromInternalTranscription: boolean("is_from_internal_transcription").default(false),
  creditsUsed: integer("credits_used").default(0),
  analysisResult: text("analysis_result"),
  categories: jsonb("categories"),
  themes: jsonb("themes"),
  quotes: jsonb("quotes"),
  status: varchar("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const analysesRelations = relations(analyses, ({ one }) => ({
  user: one(users, {
    fields: [analyses.userId],
    references: [users.id],
  }),
  transcription: one(transcriptions, {
    fields: [analyses.transcriptionId],
    references: [transcriptions.id],
  }),
}));

// Payments table
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  stripePaymentId: varchar("stripe_payment_id").unique(),
  amount: integer("amount").notNull(),
  currency: varchar("currency").notNull().default("BRL"),
  creditType: varchar("credit_type").notNull(),
  creditsAmount: integer("credits_amount").notNull(),
  status: varchar("status").notNull().default("pending"),
  source: varchar("source").notNull().default("stripe"),
  processedByAdminId: varchar("processed_by_admin_id").references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin actions audit table
export const adminActions = pgTable("admin_actions", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").references(() => users.id),
  actionType: varchar("action_type").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User access logs for tracking logins and activity
export const userAccessLogs = pgTable("user_access_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: varchar("action").notNull(), // 'login', 'logout', 'upload', 'transcription', 'analysis', 'purchase'
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userAccessLogsRelations = relations(userAccessLogs, ({ one }) => ({
  user: one(users, {
    fields: [userAccessLogs.userId],
    references: [users.id],
  }),
}));

// Credit transactions for detailed token usage tracking
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // 'purchase', 'transcription', 'analysis', 'admin_grant', 'refund'
  amount: integer("amount").notNull(), // positive for additions, negative for usage
  creditsBefore: integer("credits_before").notNull(),
  creditsAfter: integer("credits_after").notNull(),
  referenceId: varchar("reference_id"), // transcription_id, analysis_id, payment_id
  referenceType: varchar("reference_type"), // 'transcription', 'analysis', 'payment'
  description: text("description"),
  adminId: varchar("admin_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
  }),
  admin: one(users, {
    fields: [creditTransactions.adminId],
    references: [users.id],
  }),
}));

// System logs for performance monitoring
export const systemLogs = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type").notNull(), // 'transcription', 'analysis', 'error', 'warning', 'info'
  severity: varchar("severity").notNull().default("info"), // 'info', 'warning', 'error', 'critical'
  message: text("message").notNull(),
  context: jsonb("context"), // Additional context data
  durationMs: integer("duration_ms"), // Processing time for performance tracking
  userId: varchar("user_id").references(() => users.id),
  recommendation: text("recommendation"), // Suggested improvements
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemLogsRelations = relations(systemLogs, ({ one }) => ({
  user: one(users, {
    fields: [systemLogs.userId],
    references: [users.id],
  }),
}));

export const adminActionsRelations = relations(adminActions, ({ one }) => ({
  admin: one(users, {
    fields: [adminActions.adminId],
    references: [users.id],
  }),
  targetUser: one(users, {
    fields: [adminActions.targetUserId],
    references: [users.id],
  }),
}));

// Internal product catalog for secure credit mapping - indexed by lookup key
export const PRODUCT_CATALOG = {
  credits_100: {
    lookupKey: 'credits_100',
    priceInCents: 3500,
    credits: 100,
    name: 'Pacote Premium - 100 créditos',
    description: '100 créditos para transcrições e análises qualitativas',
  },
} as const;

// Pricing tiers for transcription
export const TRANSCRIPTION_PRICING = {
  creditsPerPage: 1,
  minutesPerPage: 2,
  freeMaxFileSizeMB: 10,
} as const;

// Pricing tiers for qualitative analysis (text size)
export const ANALYSIS_TEXT_TIERS = [
  { level: 1, maxPages: 20, credits: 20 },
  { level: 2, maxPages: 50, credits: 35 },
  { level: 3, maxPages: 100, credits: 60 },
  { level: 4, maxPages: 150, credits: 80 },
] as const;

// Pricing tiers for theoretical framework (reference text)
export const ANALYSIS_REFERENCE_TIERS = [
  { level: 'A', maxPages: 10, credits: 5 },
  { level: 'B', maxPages: 20, credits: 10 },
  { level: 'C', maxPages: 30, credits: 15 },
  { level: 'D', maxPages: 50, credits: 25 },
] as const;

// Free plan limits
export const FREE_PLAN_LIMITS = {
  maxTranscriptionFileSizeMB: 10,
  maxAnalysisTextPages: 10,
  maxAnalysisReferencePages: 5,
} as const;

// Helper functions for credit calculation
export function calculateTranscriptionCredits(durationMinutes: number): { pages: number; credits: number } {
  const pages = Math.ceil(durationMinutes / TRANSCRIPTION_PRICING.minutesPerPage);
  const credits = pages * TRANSCRIPTION_PRICING.creditsPerPage;
  return { pages, credits };
}

export function calculateAnalysisCredits(textPages: number, referencePages: number, isInternalTranscription: boolean): {
  textCredits: number;
  referenceCredits: number;
  totalCredits: number;
  textTier: typeof ANALYSIS_TEXT_TIERS[number] | null;
  referenceTier: typeof ANALYSIS_REFERENCE_TIERS[number] | null;
} {
  const textTier = ANALYSIS_TEXT_TIERS.find(tier => textPages <= tier.maxPages) || ANALYSIS_TEXT_TIERS[ANALYSIS_TEXT_TIERS.length - 1];
  const referenceTier = referencePages > 0 
    ? ANALYSIS_REFERENCE_TIERS.find(tier => referencePages <= tier.maxPages) || ANALYSIS_REFERENCE_TIERS[ANALYSIS_REFERENCE_TIERS.length - 1]
    : null;
  
  const textCredits = textTier.credits;
  const referenceCredits = referenceTier?.credits || 0;
  const totalCredits = textCredits + referenceCredits;
  
  return { textCredits, referenceCredits, totalCredits, textTier, referenceTier };
}

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTranscriptionSchema = createInsertSchema(transcriptions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

export const insertAdminActionSchema = createInsertSchema(adminActions).omit({
  id: true,
  createdAt: true,
});

export const insertUserAccessLogSchema = createInsertSchema(userAccessLogs).omit({
  id: true,
  createdAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type InsertTranscription = z.infer<typeof insertTranscriptionSchema>;
export type Transcription = typeof transcriptions.$inferSelect;

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export type InsertAdminAction = z.infer<typeof insertAdminActionSchema>;
export type AdminAction = typeof adminActions.$inferSelect;

export type InsertUserAccessLog = z.infer<typeof insertUserAccessLogSchema>;
export type UserAccessLog = typeof userAccessLogs.$inferSelect;

export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;

export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
export type SystemLog = typeof systemLogs.$inferSelect;
