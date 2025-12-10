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

// Users table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  freeTranscriptionUsed: boolean("free_transcription_used").default(false),
  transcriptionCredits: integer("transcription_credits").default(0),
  analysisCredits: integer("analysis_credits").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  transcriptions: many(transcriptions),
  analyses: many(analyses),
  payments: many(payments),
}));

// Transcriptions table
export const transcriptions = pgTable("transcriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: varchar("title").notNull(),
  originalFileName: varchar("original_file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  duration: integer("duration"),
  transcriptionText: text("transcription_text"),
  wordCount: integer("word_count"),
  pageCount: integer("page_count"),
  status: varchar("status").notNull().default("pending"),
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
  theoreticalFramework: text("theoretical_framework"),
  theoreticalFrameworkFileName: varchar("theoretical_framework_file_name"),
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
  stripePaymentId: varchar("stripe_payment_id"),
  amount: integer("amount").notNull(),
  currency: varchar("currency").notNull().default("BRL"),
  creditType: varchar("credit_type").notNull(),
  creditsAmount: integer("credits_amount").notNull(),
  status: varchar("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
