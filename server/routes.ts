import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import multer from "multer";
import fs from "fs";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { transcribeAudio, analyzeWithBardin, prepareAudioChunks, transcribeSingleChunk, cleanupChunks } from "./openai";
import type { TranscriptionChunkProgress, TranscriptionSegment } from "@shared/schema";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { ADMIN_EMAIL, calculateAnalysisCredits, FREE_PLAN_LIMITS } from "@shared/schema";

const upload = multer({
  dest: "/tmp/uploads/",
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    // Accept any audio or video format - ffmpeg will convert as needed
    const isAudioOrVideo = 
      file.mimetype.startsWith("audio/") || 
      file.mimetype.startsWith("video/") ||
      file.mimetype === "application/octet-stream" || // Some files come as generic binary
      file.mimetype === "application/ogg"; // OGG files often have this MIME type
    
    // Also accept PDF and text for analysis
    const isDocument = 
      file.mimetype === "application/pdf" || 
      file.mimetype === "text/plain";
    
    // Check file extension as fallback for unknown MIME types
    const audioVideoExtensions = [
      ".mp3", ".wav", ".m4a", ".mp4", ".ogg", ".webm", ".flac", ".aac",
      ".wma", ".amr", ".opus", ".3gp", ".3gpp", ".mov", ".avi", ".mkv",
      ".wmv", ".aiff", ".aif", ".caf", ".m4b", ".m4r", ".ra", ".rm",
      ".mid", ".midi", ".mka", ".mts", ".ts", ".vob", ".mpeg", ".mpg"
    ];
    const ext = "." + (file.originalname.split(".").pop()?.toLowerCase() || "");
    const hasAudioVideoExtension = audioVideoExtensions.includes(ext);
    
    if (isAudioOrVideo || isDocument || hasAudioVideoExtension) {
      cb(null, true);
    } else {
      cb(new Error("Formato de arquivo não suportado. Envie um arquivo de áudio ou vídeo."));
    }
  },
});

// Helper function to sanitize user data - removes sensitive fields
function sanitizeUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    profileImageUrl: user.profileImageUrl,
    freeTranscriptionUsed: user.freeTranscriptionUsed,
    freeAnalysisUsed: user.freeAnalysisUsed,
    credits: user.credits,
    isAdmin: user.isAdmin,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  // Auth middleware
  await setupAuth(app);

  // Admin middleware - validates user is admin
  const isAdmin = async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.email !== ADMIN_EMAIL || !user.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      next();
    } catch (error) {
      console.error("Admin middleware error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Transcription routes
  app.get("/api/transcriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transcriptions = await storage.getTranscriptionsByUser(userId);
      res.json(transcriptions);
    } catch (error) {
      console.error("Error fetching transcriptions:", error);
      res.status(500).json({ message: "Failed to fetch transcriptions" });
    }
  });

  app.get("/api/transcriptions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcription = await storage.getTranscription(id);
      
      if (!transcription || transcription.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Transcription not found" });
      }
      
      res.json(transcription);
    } catch (error) {
      console.error("Error fetching transcription:", error);
      res.status(500).json({ message: "Failed to fetch transcription" });
    }
  });

  app.post("/api/transcriptions/upload", isAuthenticated, upload.single("audio"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const title = req.body.title || file.originalname;
      const fileSize = file.size;

      // Check if user can transcribe
      const canUseFreeTrial = !user.freeTranscriptionUsed;
      const hasCredits = (user.credits || 0) > 0;

      if (!canUseFreeTrial && !hasCredits) {
        fs.unlinkSync(file.path);
        return res.status(403).json({ message: "Sem créditos disponíveis" });
      }

      // For free trial, check file size (10MB limit)
      if (canUseFreeTrial && fileSize > 10 * 1024 * 1024) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ 
          message: "Arquivo muito grande para o teste gratuito (máx. 10MB)" 
        });
      }

      // Premium quality uses WAV for paying users
      const isPremiumQuality = hasCredits && !canUseFreeTrial;

      // Create transcription record
      const transcription = await storage.createTranscription({
        userId,
        title,
        originalFileName: file.originalname,
        fileSize,
        status: "preparing",
        isPremiumQuality,
      });

      // Process transcription asynchronously with premium or standard quality
      processTranscriptionProgressive(transcription.id, file.path, userId, canUseFreeTrial, isPremiumQuality);

      res.json(transcription);
    } catch (error) {
      console.error("Error uploading transcription:", error);
      res.status(500).json({ message: "Failed to upload transcription" });
    }
  });

  app.get("/api/transcriptions/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const format = req.query.format || "txt";
      const transcription = await storage.getTranscription(id);
      
      if (!transcription || transcription.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Transcription not found" });
      }

      if (!transcription.transcriptionText) {
        return res.status(400).json({ message: "Transcription not ready" });
      }

      const filename = `${transcription.title}.${format}`;
      
      if (format === "txt") {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(transcription.transcriptionText);
      } else if (format === "docx") {
        // Simple DOCX-like output (plain text for now)
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(transcription.transcriptionText);
      } else {
        res.status(400).json({ message: "Invalid format" });
      }
    } catch (error) {
      console.error("Error downloading transcription:", error);
      res.status(500).json({ message: "Failed to download transcription" });
    }
  });

  app.delete("/api/transcriptions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcription = await storage.getTranscription(id);
      
      if (!transcription || transcription.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Transcription not found" });
      }

      await storage.deleteTranscription(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting transcription:", error);
      res.status(500).json({ message: "Failed to delete transcription" });
    }
  });

  // Save edited transcription
  app.put("/api/transcriptions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcription = await storage.getTranscription(id);
      
      if (!transcription || transcription.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Transcription not found" });
      }

      const { transcriptionText, segments, title } = req.body;

      // Build updates object
      const updates: Record<string, any> = {};

      // Handle title update
      if (title !== undefined) {
        if (typeof title !== "string" || title.trim().length === 0) {
          return res.status(400).json({ message: "Invalid title" });
        }
        updates.title = title.trim();
      }

      // Handle transcription text update
      if (transcriptionText !== undefined) {
        if (typeof transcriptionText !== "string") {
          return res.status(400).json({ message: "Invalid transcription text" });
        }
        updates.transcriptionText = transcriptionText;
        
        // Recalculate word and page count
        const wordCount = transcriptionText.split(/\s+/).filter(Boolean).length;
        const pageCount = Math.ceil(wordCount / 250);
        updates.wordCount = wordCount;
        updates.pageCount = pageCount;
      }

      // Handle segments update
      if (segments !== undefined) {
        updates.segments = segments;
      }

      // Ensure there's something to update
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid updates provided" });
      }

      await storage.updateTranscription(id, updates);

      const updated = await storage.getTranscription(id);
      res.json(updated);
    } catch (error) {
      console.error("Error updating transcription:", error);
      res.status(500).json({ message: "Failed to update transcription" });
    }
  });

  // Analysis routes
  app.get("/api/analyses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const analyses = await storage.getAnalysesByUser(userId);
      res.json(analyses);
    } catch (error) {
      console.error("Error fetching analyses:", error);
      res.status(500).json({ message: "Failed to fetch analyses" });
    }
  });

  app.get("/api/analyses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const analysis = await storage.getAnalysis(id);
      
      if (!analysis || analysis.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ message: "Failed to fetch analysis" });
    }
  });

  app.post("/api/analyses", isAuthenticated, upload.single("theoreticalFramework"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { transcriptionId, title, theoreticalFrameworkText } = req.body;
      
      if (!transcriptionId || !title) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if user has credits or free analysis
      const canUseFreeAnalysis = !user.freeAnalysisUsed;
      const hasCredits = (user.credits || 0) > 0;
      
      if (!canUseFreeAnalysis && !hasCredits) {
        return res.status(403).json({ message: "Sem créditos de análise disponíveis" });
      }

      // Get transcription
      const transcription = await storage.getTranscription(parseInt(transcriptionId));
      if (!transcription || transcription.userId !== userId) {
        return res.status(404).json({ message: "Transcription not found" });
      }

      // Get theoretical framework
      let theoreticalFramework = theoreticalFrameworkText || "";
      let theoreticalFrameworkFileName = "";

      if (req.file) {
        theoreticalFrameworkFileName = req.file.originalname;
        theoreticalFramework = fs.readFileSync(req.file.path, "utf-8");
        fs.unlinkSync(req.file.path);
      }

      // Calculate pages and credits
      const transcriptionText = transcription.transcriptionText || "";
      const textWordCount = transcriptionText.split(/\s+/).filter(Boolean).length;
      const textPages = Math.ceil(textWordCount / 250);
      
      const referenceWordCount = theoreticalFramework.split(/\s+/).filter(Boolean).length;
      const referencePages = Math.ceil(referenceWordCount / 250);

      // Calculate credits (text from internal transcription is already paid)
      const { totalCredits } = calculateAnalysisCredits(textPages, referencePages, true);
      const creditsToDeduct = canUseFreeAnalysis ? 0 : totalCredits;

      // Create analysis record
      const analysis = await storage.createAnalysis({
        userId,
        transcriptionId: parseInt(transcriptionId),
        title,
        inputText: transcriptionText,
        inputTextPages: textPages,
        theoreticalFramework,
        theoreticalFrameworkFileName: theoreticalFrameworkFileName || null,
        theoreticalFrameworkPages: referencePages,
        isFromInternalTranscription: true,
        creditsUsed: creditsToDeduct,
        status: "processing",
      });

      // Process analysis asynchronously
      processAnalysis(analysis.id, transcriptionText, theoreticalFramework, userId, creditsToDeduct, canUseFreeAnalysis);

      res.json(analysis);
    } catch (error) {
      console.error("Error creating analysis:", error);
      res.status(500).json({ message: "Failed to create analysis" });
    }
  });

  app.delete("/api/analyses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const analysis = await storage.getAnalysis(id);
      
      if (!analysis || analysis.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      await storage.deleteAnalysis(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting analysis:", error);
      res.status(500).json({ message: "Failed to delete analysis" });
    }
  });

  // Payment routes
  app.get("/api/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const payments = await storage.getPaymentsByUser(userId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // Get Stripe publishable key for frontend
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe config:", error);
      res.status(500).json({ message: "Failed to get Stripe config" });
    }
  });

  // Create Stripe checkout session for 100 credits (R$35)
  app.post("/api/checkout/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create or get Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
        const customer = await stripeService.createCustomer(
          user.email || "",
          userId,
          fullName || undefined
        );
        stripeCustomerId = customer.id;
        await storage.updateUserStripeCustomerId(userId, customer.id);
      }

      // Create checkout session for 100 credits
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripeService.createCheckoutSession(
        stripeCustomerId,
        `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/checkout/cancel`,
        userId
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Handle successful checkout - read-only verification
  app.get("/api/checkout/success", isAuthenticated, async (req: any, res) => {
    try {
      const { session_id } = req.query;
      
      if (!session_id) {
        return res.status(400).json({ message: "Missing session ID" });
      }

      const result = await stripeService.verifyCheckoutSession(session_id as string);
      
      if (result.success) {
        res.json({ 
          success: true, 
          creditsAmount: result.creditsAmount,
          message: result.message || `Pagamento confirmado! Seus créditos serão adicionados em breve.`
        });
      } else {
        res.status(400).json({ message: "Payment not completed" });
      }
    } catch (error) {
      console.error("Error handling checkout success:", error);
      res.status(500).json({ message: "Failed to process payment" });
    }
  });

  // ========================================
  // ADMIN ROUTES - Protected with isAdmin middleware
  // ========================================

  // Get all users (excluding admin) - sanitized
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsersExcludingAdmin();
      res.json(users.map(sanitizeUser));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get all payments
  app.get("/api/admin/payments", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // Get admin actions (audit log)
  app.get("/api/admin/actions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const actions = await storage.getAdminActions();
      res.json(actions);
    } catch (error) {
      console.error("Error fetching admin actions:", error);
      res.status(500).json({ message: "Failed to fetch admin actions" });
    }
  });

  // Manual credit addition schema
  const manualCreditSchema = z.object({
    userId: z.string().min(1),
    amount: z.number().int().positive().max(10000),
    reason: z.string().min(1).max(500),
  });

  // Add manual credits to user
  app.post("/api/admin/credits/manual", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      
      const parseResult = manualCreditSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request data", errors: parseResult.error.errors });
      }

      const { userId, amount, reason } = parseResult.data;

      // Verify target user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const creditsBefore = targetUser.credits || 0;
      
      // Add credits to user
      const updatedUser = await storage.addCredits(userId, amount);

      // Create credit transaction record
      await storage.createCreditTransaction({
        userId,
        type: "admin_grant",
        amount,
        creditsBefore,
        creditsAfter: creditsBefore + amount,
        description: reason,
        adminId,
      });

      // Create manual payment record
      await storage.createManualPayment({
        userId,
        amount: 0,
        currency: "BRL",
        creditType: "credits",
        creditsAmount: amount,
        status: "completed",
        source: "manual",
        processedByAdminId: adminId,
        reason,
      });

      // Log admin action
      await storage.createAdminAction({
        adminId,
        targetUserId: userId,
        actionType: "manual_credit_add",
        payload: { amount, reason },
      });

      res.json({ 
        success: true, 
        message: `${amount} créditos adicionados com sucesso.`,
        user: sanitizeUser(updatedUser) 
      });
    } catch (error) {
      console.error("Error adding manual credits:", error);
      res.status(500).json({ message: "Failed to add credits" });
    }
  });

  // Setup admin on first login with admin email
  app.post("/api/admin/setup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only allow admin setup for the designated admin email
      if (user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Already an admin
      if (user.isAdmin) {
        return res.json({ success: true, message: "Already admin" });
      }

      // Set user as admin
      const updatedUser = await storage.setUserAsAdmin(userId);

      // Log admin action
      await storage.createAdminAction({
        adminId: userId,
        targetUserId: userId,
        actionType: "admin_setup",
        payload: { email: user.email },
      });

      res.json({ success: true, user: sanitizeUser(updatedUser) });
    } catch (error) {
      console.error("Error setting up admin:", error);
      res.status(500).json({ message: "Failed to setup admin" });
    }
  });

  // Get all users (for admin dashboard) - sanitized
  app.get("/api/admin/users/all", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(sanitizeUser));
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Toggle user active status
  app.patch("/api/admin/users/:userId/status", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { userId } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deactivating the admin
      if (targetUser.email === ADMIN_EMAIL) {
        return res.status(403).json({ message: "Cannot deactivate admin user" });
      }

      const updatedUser = await storage.setUserActiveStatus(userId, isActive);

      await storage.createAdminAction({
        adminId,
        targetUserId: userId,
        actionType: isActive ? "user_activate" : "user_deactivate",
        payload: { previousStatus: targetUser.isActive },
      });

      res.json({ success: true, user: sanitizeUser(updatedUser) });
    } catch (error) {
      console.error("Error toggling user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // Get user access logs
  app.get("/api/admin/users/:userId/access-logs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const logs = await storage.getUserAccessLogs(userId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching user access logs:", error);
      res.status(500).json({ message: "Failed to fetch access logs" });
    }
  });

  // Get all access logs
  app.get("/api/admin/access-logs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      const logs = await storage.getAllAccessLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching all access logs:", error);
      res.status(500).json({ message: "Failed to fetch access logs" });
    }
  });

  // Get credit transactions
  app.get("/api/admin/credit-transactions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      const transactions = await storage.getAllCreditTransactions(limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching credit transactions:", error);
      res.status(500).json({ message: "Failed to fetch credit transactions" });
    }
  });

  // Get credit transactions summary
  app.get("/api/admin/credit-transactions/summary", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const summary = await storage.getCreditTransactionsSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching credit transactions summary:", error);
      res.status(500).json({ message: "Failed to fetch summary" });
    }
  });

  // Get user credit transactions
  app.get("/api/admin/users/:userId/credit-transactions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const transactions = await storage.getCreditTransactions(userId, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching user credit transactions:", error);
      res.status(500).json({ message: "Failed to fetch credit transactions" });
    }
  });

  // Get revenue stats
  app.get("/api/admin/revenue/stats", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getRevenueStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching revenue stats:", error);
      res.status(500).json({ message: "Failed to fetch revenue stats" });
    }
  });

  // Get revenue by period
  app.get("/api/admin/revenue/period", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      
      const payments = await storage.getRevenueByPeriod(startDate, endDate);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching revenue by period:", error);
      res.status(500).json({ message: "Failed to fetch revenue data" });
    }
  });

  // Get system logs
  app.get("/api/admin/system-logs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      const severity = req.query.severity as string | undefined;
      const logs = await storage.getSystemLogs(limit, severity);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching system logs:", error);
      res.status(500).json({ message: "Failed to fetch system logs" });
    }
  });

  // Get performance stats
  app.get("/api/admin/performance/stats", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getPerformanceStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching performance stats:", error);
      res.status(500).json({ message: "Failed to fetch performance stats" });
    }
  });

  // Get admin actions (audit trail)
  app.get("/api/admin/actions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const actions = await storage.getAdminActions();
      res.json(actions);
    } catch (error) {
      console.error("Error fetching admin actions:", error);
      res.status(500).json({ message: "Failed to fetch admin actions" });
    }
  });

  // Delete user (soft delete - just deactivate)
  app.delete("/api/admin/users/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { userId } = req.params;

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deleting the admin
      if (targetUser.email === ADMIN_EMAIL) {
        return res.status(403).json({ message: "Cannot delete admin user" });
      }

      // Soft delete by deactivating
      const updatedUser = await storage.setUserActiveStatus(userId, false);

      await storage.createAdminAction({
        adminId,
        targetUserId: userId,
        actionType: "user_deleted",
        payload: { email: targetUser.email },
      });

      res.json({ success: true, message: "Usuário desativado com sucesso" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
}

// Background processing functions - Progressive transcription with chunk tracking
async function processTranscriptionProgressive(
  transcriptionId: number, 
  filePath: string, 
  userId: string, 
  useFreeCredit: boolean,
  isPremiumQuality: boolean
) {
  let convertedPath: string | null = null;
  let chunks: { path: string; startOffset: number }[] = [];
  
  try {
    // Prepare audio chunks (WAV for premium, MP3 for free)
    console.log(`Preparing audio for transcription ${transcriptionId}, premium: ${isPremiumQuality}`);
    const prepared = await prepareAudioChunks(filePath, isPremiumQuality);
    convertedPath = prepared.convertedPath;
    chunks = prepared.chunks;
    
    // Initialize chunk progress
    const chunkProgress: TranscriptionChunkProgress[] = chunks.map((chunk, i) => ({
      chunkIndex: i,
      totalChunks: chunks.length,
      status: "pending" as const,
      startOffset: chunk.startOffset,
    }));
    
    await storage.updateTranscription(transcriptionId, {
      status: "processing",
      duration: Math.round(prepared.duration),
      totalChunks: chunks.length,
      completedChunks: 0,
      chunkProgress,
    });
    
    // Process each chunk
    let fullText = "";
    let allSegments: TranscriptionSegment[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Transcribing chunk ${i + 1}/${chunks.length} for transcription ${transcriptionId}`);
      
      // Mark chunk as processing
      await storage.updateChunkProgress(transcriptionId, i, { status: "processing" });
      
      try {
        const result = await transcribeSingleChunk(chunks[i].path, chunks[i].startOffset);
        
        fullText += (fullText ? " " : "") + result.text;
        allSegments = allSegments.concat(result.segments);
        
        // Mark chunk as completed with text
        await storage.updateChunkProgress(transcriptionId, i, { 
          status: "completed",
          text: result.text,
          segments: result.segments,
        });
        
      } catch (chunkError: any) {
        console.error(`Error transcribing chunk ${i}:`, chunkError);
        await storage.updateChunkProgress(transcriptionId, i, { 
          status: "error",
          error: chunkError.message,
        });
        throw chunkError;
      }
    }
    
    // Calculate word and page count
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    const pageCount = Math.ceil(wordCount / 250);

    // Update transcription with final result
    await storage.updateTranscription(transcriptionId, {
      transcriptionText: fullText,
      segments: allSegments,
      wordCount,
      pageCount,
      status: "completed",
      completedAt: new Date(),
    });

    // Update user credits
    if (useFreeCredit) {
      await storage.markFreeTranscriptionUsed(userId);
    } else {
      await storage.deductCredits(userId, pageCount);
    }

    // Clean up files
    cleanupChunks(convertedPath, chunks, filePath);
    try { fs.unlinkSync(filePath); } catch (e) {}
    
  } catch (error) {
    console.error("Error processing transcription:", error);
    await storage.updateTranscription(transcriptionId, {
      status: "error",
    });
    
    // Clean up files
    if (convertedPath) cleanupChunks(convertedPath, chunks, filePath);
    try { fs.unlinkSync(filePath); } catch (e) {}
  }
}

async function processAnalysis(analysisId: number, transcriptionText: string, theoreticalFramework: string, userId: string, creditsToDeduct: number, useFreeAnalysis: boolean) {
  try {
    // Perform Bardin analysis
    const result = await analyzeWithBardin(transcriptionText, theoreticalFramework);

    // Update analysis
    await storage.updateAnalysis(analysisId, {
      analysisResult: result.analysis,
      categories: result.categories,
      themes: result.themes,
      quotes: result.quotes,
      status: "completed",
      completedAt: new Date(),
    });

    // Update user credits
    if (useFreeAnalysis) {
      await storage.markFreeAnalysisUsed(userId);
    } else if (creditsToDeduct > 0) {
      await storage.deductCredits(userId, creditsToDeduct);
    }
  } catch (error) {
    console.error("Error processing analysis:", error);
    await storage.updateAnalysis(analysisId, {
      status: "error",
    });
  }
}
