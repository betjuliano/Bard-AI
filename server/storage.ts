import {
  users,
  transcriptions,
  analyses,
  payments,
  type User,
  type UpsertUser,
  type Transcription,
  type InsertTranscription,
  type Analysis,
  type InsertAnalysis,
  type Payment,
  type InsertPayment,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, or } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserCredits(userId: string, transcriptionCredits?: number, analysisCredits?: number): Promise<User>;
  markFreeTranscriptionUsed(userId: string): Promise<void>;

  // Transcription operations
  getTranscription(id: number): Promise<Transcription | undefined>;
  getTranscriptionsByUser(userId: string): Promise<Transcription[]>;
  createTranscription(transcription: InsertTranscription): Promise<Transcription>;
  updateTranscription(id: number, updates: Partial<Transcription>): Promise<Transcription>;
  deleteTranscription(id: number): Promise<void>;
  searchTranscriptions(userId: string, query: string): Promise<Transcription[]>;

  // Analysis operations
  getAnalysis(id: number): Promise<Analysis | undefined>;
  getAnalysesByUser(userId: string): Promise<Analysis[]>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  updateAnalysis(id: number, updates: Partial<Analysis>): Promise<Analysis>;
  deleteAnalysis(id: number): Promise<void>;

  // Payment operations
  getPaymentsByUser(userId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePaymentStatus(id: number, status: string, stripePaymentId?: string): Promise<Payment>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserCredits(userId: string, transcriptionCredits?: number, analysisCredits?: number): Promise<User> {
    const updateData: Partial<User> = { updatedAt: new Date() };
    if (transcriptionCredits !== undefined) {
      updateData.transcriptionCredits = transcriptionCredits;
    }
    if (analysisCredits !== undefined) {
      updateData.analysisCredits = analysisCredits;
    }
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async markFreeTranscriptionUsed(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ freeTranscriptionUsed: true, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Transcription operations
  async getTranscription(id: number): Promise<Transcription | undefined> {
    const [transcription] = await db
      .select()
      .from(transcriptions)
      .where(eq(transcriptions.id, id));
    return transcription;
  }

  async getTranscriptionsByUser(userId: string): Promise<Transcription[]> {
    return await db
      .select()
      .from(transcriptions)
      .where(eq(transcriptions.userId, userId))
      .orderBy(desc(transcriptions.createdAt));
  }

  async createTranscription(transcription: InsertTranscription): Promise<Transcription> {
    const [newTranscription] = await db
      .insert(transcriptions)
      .values(transcription)
      .returning();
    return newTranscription;
  }

  async updateTranscription(id: number, updates: Partial<Transcription>): Promise<Transcription> {
    const [transcription] = await db
      .update(transcriptions)
      .set(updates)
      .where(eq(transcriptions.id, id))
      .returning();
    return transcription;
  }

  async deleteTranscription(id: number): Promise<void> {
    await db.delete(transcriptions).where(eq(transcriptions.id, id));
  }

  async searchTranscriptions(userId: string, query: string): Promise<Transcription[]> {
    return await db
      .select()
      .from(transcriptions)
      .where(
        and(
          eq(transcriptions.userId, userId),
          or(
            ilike(transcriptions.title, `%${query}%`),
            ilike(transcriptions.transcriptionText, `%${query}%`)
          )
        )
      )
      .orderBy(desc(transcriptions.createdAt));
  }

  // Analysis operations
  async getAnalysis(id: number): Promise<Analysis | undefined> {
    const [analysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, id));
    return analysis;
  }

  async getAnalysesByUser(userId: string): Promise<Analysis[]> {
    return await db
      .select()
      .from(analyses)
      .where(eq(analyses.userId, userId))
      .orderBy(desc(analyses.createdAt));
  }

  async createAnalysis(analysis: InsertAnalysis): Promise<Analysis> {
    const [newAnalysis] = await db
      .insert(analyses)
      .values(analysis)
      .returning();
    return newAnalysis;
  }

  async updateAnalysis(id: number, updates: Partial<Analysis>): Promise<Analysis> {
    const [analysis] = await db
      .update(analyses)
      .set(updates)
      .where(eq(analyses.id, id))
      .returning();
    return analysis;
  }

  async deleteAnalysis(id: number): Promise<void> {
    await db.delete(analyses).where(eq(analyses.id, id));
  }

  // Payment operations
  async getPaymentsByUser(userId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db
      .insert(payments)
      .values(payment)
      .returning();
    return newPayment;
  }

  async updatePaymentStatus(id: number, status: string, stripePaymentId?: string): Promise<Payment> {
    const updateData: Partial<Payment> = { status };
    if (stripePaymentId) {
      updateData.stripePaymentId = stripePaymentId;
    }
    const [payment] = await db
      .update(payments)
      .set(updateData)
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }
}

export const storage = new DatabaseStorage();
