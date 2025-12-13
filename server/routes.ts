import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import multer from "multer";
import fs from "fs";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { transcribeAudio, analyzeWithBardin } from "./openai";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { ADMIN_EMAIL, calculateAnalysisCredits, FREE_PLAN_LIMITS } from "@shared/schema";

const upload = multer({
  dest: "/tmp/uploads/",
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "audio/mpeg",
      "audio/wav",
      "audio/x-m4a",
      "audio/mp4",
      "audio/x-wav",
      "audio/ogg",
      "audio/webm",
      "audio/flac",
      "audio/aac",
      "video/mp4",
      "video/webm",
      "video/ogg",
      "application/pdf",
      "text/plain",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de arquivo não suportado"));
    }
  },
});

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
      res.json(user);
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

      // Create transcription record
      const transcription = await storage.createTranscription({
        userId,
        title,
        originalFileName: file.originalname,
        fileSize,
        status: "processing",
      });

      // Process transcription asynchronously
      processTranscription(transcription.id, file.path, userId, canUseFreeTrial);

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

  // Get all users (excluding admin)
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsersExcludingAdmin();
      res.json(users);
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

      // Add credits to user
      const updatedUser = await storage.addCredits(userId, amount);

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
        user: updatedUser 
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

      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Error setting up admin:", error);
      res.status(500).json({ message: "Failed to setup admin" });
    }
  });
}

// Background processing functions
async function processTranscription(transcriptionId: number, filePath: string, userId: string, useFreeCredit: boolean) {
  try {
    // Transcribe audio
    const result = await transcribeAudio(filePath);
    
    // Calculate word and page count
    const wordCount = result.text.split(/\s+/).filter(Boolean).length;
    const pageCount = Math.ceil(wordCount / 250); // ~250 words per page

    // Update transcription
    await storage.updateTranscription(transcriptionId, {
      transcriptionText: result.text,
      wordCount,
      pageCount,
      status: "completed",
      completedAt: new Date(),
    });

    // Update user credits
    if (useFreeCredit) {
      await storage.markFreeTranscriptionUsed(userId);
    } else {
      // Deduct credits based on pages (1 page = 1 credit)
      await storage.deductCredits(userId, pageCount);
    }

    // Clean up file
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error("Error processing transcription:", error);
    await storage.updateTranscription(transcriptionId, {
      status: "error",
    });
    
    // Clean up file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      // Ignore cleanup errors
    }
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
