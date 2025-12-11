import {
  users,
  transcriptions,
  analyses,
  payments,
  adminActions,
  ADMIN_EMAIL,
  type User,
  type UpsertUser,
  type Transcription,
  type InsertTranscription,
  type Analysis,
  type InsertAnalysis,
  type Payment,
  type InsertPayment,
  type AdminAction,
  type InsertAdminAction,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, or, ne, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserCredits(userId: string, credits: number): Promise<User>;
  updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User>;
  markFreeTranscriptionUsed(userId: string): Promise<void>;
  markFreeAnalysisUsed(userId: string): Promise<void>;
  updateUserCpf(userId: string, fullName: string, cpf: string): Promise<User>;
  getUserByCpf(cpf: string): Promise<User | undefined>;
  deductCredits(userId: string, amount: number): Promise<User>;
  addCredits(userId: string, amount: number): Promise<User>;

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
  getPaymentByStripeId(stripePaymentId: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  createPaymentIdempotent(payment: InsertPayment): Promise<boolean>;
  updatePaymentStatus(id: number, status: string, stripePaymentId?: string): Promise<Payment>;

  // Admin operations
  getAllUsersExcludingAdmin(): Promise<User[]>;
  getAllPayments(): Promise<Payment[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  setUserAsAdmin(userId: string): Promise<User>;
  createManualPayment(payment: InsertPayment): Promise<Payment>;
  createAdminAction(action: InsertAdminAction): Promise<AdminAction>;
  getAdminActions(): Promise<AdminAction[]>;
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

  async updateUserCredits(userId: string, credits: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ credits, updatedAt: new Date() })
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

  async markFreeAnalysisUsed(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ freeAnalysisUsed: true, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateUserCpf(userId: string, fullName: string, cpf: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ fullName, cpf, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserByCpf(cpf: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.cpf, cpf));
    return user;
  }

  async deductCredits(userId: string, amount: number): Promise<User> {
    const existingUser = await this.getUser(userId);
    if (!existingUser) {
      throw new Error("User not found");
    }
    const currentCredits = existingUser.credits || 0;
    if (currentCredits < amount) {
      throw new Error(`Créditos insuficientes. Você tem ${currentCredits} créditos, mas precisa de ${amount}.`);
    }
    const [user] = await db
      .update(users)
      .set({
        credits: currentCredits - amount,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async addCredits(userId: string, amount: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        credits: sql`${users.credits} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
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

  async getPaymentByStripeId(stripePaymentId: string): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentId, stripePaymentId));
    return payment;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db
      .insert(payments)
      .values(payment)
      .returning();
    return newPayment;
  }

  async createPaymentIdempotent(payment: InsertPayment): Promise<boolean> {
    const result = await db
      .insert(payments)
      .values(payment)
      .onConflictDoNothing({ target: payments.stripePaymentId })
      .returning();
    return result.length > 0;
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

  // Admin operations
  async getAllUsersExcludingAdmin(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(ne(users.isAdmin, true))
      .orderBy(desc(users.createdAt));
  }

  async getAllPayments(): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async setUserAsAdmin(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isAdmin: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createManualPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db
      .insert(payments)
      .values({ ...payment, source: "manual" })
      .returning();
    return newPayment;
  }

  async createAdminAction(action: InsertAdminAction): Promise<AdminAction> {
    const [newAction] = await db
      .insert(adminActions)
      .values(action)
      .returning();
    return newAction;
  }

  async getAdminActions(): Promise<AdminAction[]> {
    return await db
      .select()
      .from(adminActions)
      .orderBy(desc(adminActions.createdAt));
  }

}

export const storage = new DatabaseStorage();
