import {
  users,
  transcriptions,
  analyses,
  payments,
  adminActions,
  userAccessLogs,
  creditTransactions,
  systemLogs,
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
  type UserAccessLog,
  type InsertUserAccessLog,
  type CreditTransaction,
  type InsertCreditTransaction,
  type SystemLog,
  type InsertSystemLog,
  type TranscriptionChunkProgress,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, or, ne, sql, gte, lte, count, sum } from "drizzle-orm";

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
  updateChunkProgress(id: number, chunkIndex: number, progress: Partial<TranscriptionChunkProgress>): Promise<Transcription>;
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
  getAllUsers(): Promise<User[]>;
  getAllPayments(): Promise<Payment[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  setUserAsAdmin(userId: string): Promise<User>;
  setUserActiveStatus(userId: string, isActive: boolean): Promise<User>;
  updateUserLastLogin(userId: string): Promise<void>;
  createManualPayment(payment: InsertPayment): Promise<Payment>;
  createAdminAction(action: InsertAdminAction): Promise<AdminAction>;
  getAdminActions(): Promise<AdminAction[]>;

  // User access logs
  createUserAccessLog(log: InsertUserAccessLog): Promise<UserAccessLog>;
  getUserAccessLogs(userId: string, limit?: number): Promise<UserAccessLog[]>;
  getAllAccessLogs(limit?: number): Promise<UserAccessLog[]>;

  // Credit transactions
  createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction>;
  getCreditTransactions(userId: string, limit?: number): Promise<CreditTransaction[]>;
  getAllCreditTransactions(limit?: number): Promise<CreditTransaction[]>;
  getCreditTransactionsSummary(): Promise<{ totalCreditsUsed: number; totalCreditsAdded: number; transactionCount: number }>;

  // System logs
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;
  getSystemLogs(limit?: number, severity?: string): Promise<SystemLog[]>;
  getPerformanceStats(): Promise<{ avgDuration: number; errorCount: number; warningCount: number; totalLogs: number }>;

  // Revenue analytics
  getRevenueStats(): Promise<{ totalRevenue: number; totalPayments: number; completedPayments: number }>;
  getRevenueByPeriod(startDate: Date, endDate: Date): Promise<Payment[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if a user with this email already exists (with different ID)
    if (userData.email) {
      const existingByEmail = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail.length > 0 && existingByEmail[0].id !== userData.id) {
        // Update existing user by email match instead of creating duplicate
        const [user] = await db
          .update(users)
          .set({
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.email, userData.email))
          .returning();
        return user;
      }
    }
    
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

  async updateChunkProgress(id: number, chunkIndex: number, progress: Partial<TranscriptionChunkProgress>): Promise<Transcription> {
    const transcription = await this.getTranscription(id);
    if (!transcription) throw new Error("Transcription not found");
    
    const chunkProgress = (transcription.chunkProgress || []) as TranscriptionChunkProgress[];
    if (chunkProgress[chunkIndex]) {
      chunkProgress[chunkIndex] = { ...chunkProgress[chunkIndex], ...progress };
    }
    
    const completedChunks = chunkProgress.filter(c => c.status === "completed").length;
    
    const [updated] = await db
      .update(transcriptions)
      .set({ chunkProgress, completedChunks })
      .where(eq(transcriptions.id, id))
      .returning();
    return updated;
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

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async setUserActiveStatus(userId: string, isActive: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // User access logs
  async createUserAccessLog(log: InsertUserAccessLog): Promise<UserAccessLog> {
    const [newLog] = await db
      .insert(userAccessLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getUserAccessLogs(userId: string, limit: number = 100): Promise<UserAccessLog[]> {
    return await db
      .select()
      .from(userAccessLogs)
      .where(eq(userAccessLogs.userId, userId))
      .orderBy(desc(userAccessLogs.createdAt))
      .limit(limit);
  }

  async getAllAccessLogs(limit: number = 500): Promise<UserAccessLog[]> {
    return await db
      .select()
      .from(userAccessLogs)
      .orderBy(desc(userAccessLogs.createdAt))
      .limit(limit);
  }

  // Credit transactions
  async createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const [newTransaction] = await db
      .insert(creditTransactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getCreditTransactions(userId: string, limit: number = 100): Promise<CreditTransaction[]> {
    return await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit);
  }

  async getAllCreditTransactions(limit: number = 500): Promise<CreditTransaction[]> {
    return await db
      .select()
      .from(creditTransactions)
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit);
  }

  async getCreditTransactionsSummary(): Promise<{ totalCreditsUsed: number; totalCreditsAdded: number; transactionCount: number }> {
    const result = await db
      .select({
        totalCreditsUsed: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} < 0 THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0)`,
        totalCreditsAdded: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} > 0 THEN ${creditTransactions.amount} ELSE 0 END), 0)`,
        transactionCount: count(),
      })
      .from(creditTransactions);
    return result[0] || { totalCreditsUsed: 0, totalCreditsAdded: 0, transactionCount: 0 };
  }

  // System logs
  async createSystemLog(log: InsertSystemLog): Promise<SystemLog> {
    const [newLog] = await db
      .insert(systemLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getSystemLogs(limit: number = 500, severity?: string): Promise<SystemLog[]> {
    if (severity) {
      return await db
        .select()
        .from(systemLogs)
        .where(eq(systemLogs.severity, severity))
        .orderBy(desc(systemLogs.createdAt))
        .limit(limit);
    }
    return await db
      .select()
      .from(systemLogs)
      .orderBy(desc(systemLogs.createdAt))
      .limit(limit);
  }

  async getPerformanceStats(): Promise<{ avgDuration: number; errorCount: number; warningCount: number; totalLogs: number }> {
    const result = await db
      .select({
        avgDuration: sql<number>`COALESCE(AVG(${systemLogs.durationMs}), 0)`,
        errorCount: sql<number>`COUNT(CASE WHEN ${systemLogs.severity} = 'error' THEN 1 END)`,
        warningCount: sql<number>`COUNT(CASE WHEN ${systemLogs.severity} = 'warning' THEN 1 END)`,
        totalLogs: count(),
      })
      .from(systemLogs);
    return result[0] || { avgDuration: 0, errorCount: 0, warningCount: 0, totalLogs: 0 };
  }

  // Revenue analytics
  async getRevenueStats(): Promise<{ totalRevenue: number; totalPayments: number; completedPayments: number }> {
    const result = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${payments.status} = 'completed' THEN ${payments.amount} ELSE 0 END), 0)`,
        totalPayments: count(),
        completedPayments: sql<number>`COUNT(CASE WHEN ${payments.status} = 'completed' THEN 1 END)`,
      })
      .from(payments);
    return result[0] || { totalRevenue: 0, totalPayments: 0, completedPayments: 0 };
  }

  async getRevenueByPeriod(startDate: Date, endDate: Date): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(and(
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate),
        eq(payments.status, "completed")
      ))
      .orderBy(desc(payments.createdAt));
  }

}

export const storage = new DatabaseStorage();
