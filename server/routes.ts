import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import fs from "fs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { transcribeAudio, analyzeWithBardin } from "./openai";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";

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
      const hasCredits = (user.transcriptionCredits || 0) > 0;

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

      // Check if user has analysis credits
      const hasCredits = (user.analysisCredits || 0) > 0 || !user.freeTranscriptionUsed;
      
      if (!hasCredits) {
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

      // Create analysis record
      const analysis = await storage.createAnalysis({
        userId,
        transcriptionId: parseInt(transcriptionId),
        title,
        theoreticalFramework,
        theoreticalFrameworkFileName: theoreticalFrameworkFileName || null,
        status: "processing",
      });

      // Process analysis asynchronously
      processAnalysis(analysis.id, transcription.transcriptionText || "", theoreticalFramework, userId);

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

  // Create Stripe checkout session
  app.post("/api/checkout/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { creditType } = req.body;

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!creditType || !["transcription", "analysis"].includes(creditType)) {
        return res.status(400).json({ message: "Invalid credit type" });
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

      // Create checkout session
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripeService.createCheckoutSession(
        stripeCustomerId,
        creditType as "transcription" | "analysis",
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

  // Handle successful checkout
  app.get("/api/checkout/success", isAuthenticated, async (req: any, res) => {
    try {
      const { session_id } = req.query;
      
      if (!session_id) {
        return res.status(400).json({ message: "Missing session ID" });
      }

      const result = await stripeService.handlePaymentSuccess(session_id as string);
      
      if (result.success) {
        res.json({ 
          success: true, 
          creditType: result.creditType,
          creditsAmount: result.creditsAmount,
          message: `Créditos adicionados com sucesso!` 
        });
      } else {
        res.status(400).json({ message: "Payment not completed" });
      }
    } catch (error) {
      console.error("Error handling checkout success:", error);
      res.status(500).json({ message: "Failed to process payment" });
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
      const user = await storage.getUser(userId);
      if (user && user.transcriptionCredits) {
        const pagesUsed = Math.min(pageCount, user.transcriptionCredits);
        await storage.updateUserCredits(
          userId,
          user.transcriptionCredits - pagesUsed,
          user.analysisCredits || 0
        );
      }
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

async function processAnalysis(analysisId: number, transcriptionText: string, theoreticalFramework: string, userId: string) {
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
    const user = await storage.getUser(userId);
    if (user) {
      if (!user.freeTranscriptionUsed) {
        await storage.markFreeTranscriptionUsed(userId);
      } else if (user.analysisCredits && user.analysisCredits > 0) {
        await storage.updateUserCredits(
          userId,
          user.transcriptionCredits || 0,
          user.analysisCredits - 1
        );
      }
    }
  } catch (error) {
    console.error("Error processing analysis:", error);
    await storage.updateAnalysis(analysisId, {
      status: "error",
    });
  }
}
