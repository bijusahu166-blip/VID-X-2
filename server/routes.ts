import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authStorage } from "./replit_integrations/auth/storage";
import { setupAuth, registerAuthRoutes, registerSmsOtpRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { api } from "@shared/routes";
import { users, posts, comments, savedPosts, reports, notifications, conversations, messages, pendingBlocks } from "@shared/schema";
import { db } from "./db";
import { sql, eq, desc, and } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import { wsClients } from "./realtime";

const GEMINI_MODEL_FALLBACKS = [
  process.env.GEMINI_MODEL || "gemini-2.0-flash",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash",
];

async function generateGeminiContent(genAI: GoogleGenerativeAI, prompt: string) {
  let lastError: any;
  for (const modelName of GEMINI_MODEL_FALLBACKS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return { modelName, result };
    } catch (err: any) {
      lastError = err;
      console.warn(`[ai] Gemini model ${modelName} failed:`, err?.message || err);
    }
  }
  throw lastError;
}

// --- CONFIGURATION ---
const uploadsDir = path.join(process.cwd(), "uploads", "videos");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// --- MULTER: All file types (memory storage) ---
const anyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype;
    const name = file.originalname.toLowerCase();
    const allowedMime = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml",
      "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/avi",
      "video/x-matroska", "video/3gpp",
      "application/pdf", "text/plain", "application/octet-stream",
    ];
    const allowedExt = [
      ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
      ".mp4", ".webm", ".mov", ".avi", ".mkv", ".3gp",
      ".pdf", ".txt",
    ];
    const extOk = allowedExt.some(ext => name.endsWith(ext));
    if (allowedMime.includes(mime) || extOk) cb(null, true);
    else cb(new Error(`File type not supported: ${mime}`));
  },
});

// --- MULTER: Book PDF/TXT Upload ---
const bookUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const allowed =
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/octet-stream" ||
      file.mimetype === "text/plain" ||
      name.endsWith(".pdf") ||
      name.endsWith(".txt");
    if (allowed) cb(null, true);
    else cb(new Error("Only PDF or TXT files allowed"));
  },
});

// --- CLOUDINARY HELPER ---
async function uploadToCloudinary(
  buffer: Buffer,
  resourceType: "image" | "video" | "raw" | "auto",
  folder: string
): Promise<{ url: string; publicId: string; format: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder,
        public_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result!.secure_url,
          publicId: result!.public_id,
          format: result!.format,
          bytes: result!.bytes,
        });
      }
    );
    stream.end(buffer);
  });
}

// --- CLOUDINARY DELETE HELPER ---
async function deleteFromCloudinary(mediaUrl: string): Promise<void> {
  try {
    const urlParts = mediaUrl.split("/");
    const uploadIndex = urlParts.indexOf("upload");
    if (uploadIndex === -1) return;
    const afterUpload = urlParts.slice(uploadIndex + 1);
    if (afterUpload[0]?.startsWith("v")) afterUpload.shift();
    const publicIdWithExt = afterUpload.join("/");
    const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");

    // Try image first, then video
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    } catch {
      await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
    }
  } catch (err) {
    console.error("[cloudinary delete] Error:", err);
  }
}

// --- AUTO-DELETE LOGIC (2 Hours) ---
setInterval(async () => {
  try {
    await db.execute(sql`
      UPDATE posts 
      SET type = 'deleted' 
      WHERE id IN (SELECT reported_post_id FROM reports) 
      AND created_at < NOW() - INTERVAL '2 hours'
    `);
  } catch (err) {
    console.error("[cleanup error]", err);
  }
}, 15 * 60 * 1000);

// --- SEED ---
async function seed() {
  try {
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) return;
    console.log("Seeding database...");
    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash("password123", 10);
    await db.insert(users).values({
      email: "alice@example.com",
      password: hashed,
      firstName: "Alice",
      lastName: "Wonder",
      username: "alicewonder",
      profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
    });
    console.log("Database seeded!");
  } catch (err) {
    console.error("[seed error]", err);
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  await setupAuth(app);
  registerAuthRoutes(app);
  registerSmsOtpRoutes(app);
  registerChatRoutes(app);
  registerImageRoutes(app);

  const settingsRoutes = await import('./routes/settings');
  const messagesRoutes = await import('./routes/messages');
  app.use('/api/settings', settingsRoutes.default);
  app.use('/api/messages', messagesRoutes.default);

  seed().catch(console.error);

  // ══════════════════════════════════════════════════════════════════════════
  // UPLOAD ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/upload/video", isAuthenticated, (req: any, res: any) => {
    anyUpload.single("video")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No video file received. Field name: 'video'" });
      try {
        const result = await uploadToCloudinary(req.file.buffer, "video", "vid-x/videos");
        res.json({ success: true, url: result.url, videoUrl: result.url, publicId: result.publicId });
      } catch (err: any) {
        res.status(500).json({ message: `Video upload failed: ${err.message}` });
      }
    });
  });

  app.post("/api/upload/image", isAuthenticated, (req: any, res: any) => {
    anyUpload.single("image")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No image file received. Field name: 'image'" });
      try {
        const result = await uploadToCloudinary(req.file.buffer, "image", "vid-x/images");
        res.json({ success: true, url: result.url, imageUrl: result.url, publicId: result.publicId });
      } catch (err: any) {
        res.status(500).json({ message: `Image upload failed: ${err.message}` });
      }
    });
  });

  app.post("/api/upload/profile-image", isAuthenticated, (req: any, res: any) => {
    anyUpload.single("image")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No image received. Field name: 'image'" });
      try {
        const result = await uploadToCloudinary(req.file.buffer, "image", "vid-x/profiles");
        res.json({ success: true, url: result.url, imageUrl: result.url, profileImageUrl: result.url, publicId: result.publicId });
      } catch (err: any) {
        res.status(500).json({ message: `Profile image upload failed: ${err.message}` });
      }
    });
  });

  app.post("/api/upload/pdf", isAuthenticated, (req: any, res: any) => {
    anyUpload.single("pdf")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No PDF received. Field name: 'pdf'" });
      try {
        const result = await uploadToCloudinary(req.file.buffer, "raw", "vid-x/pdfs");
        res.json({ success: true, url: result.url, pdfUrl: result.url, publicId: result.publicId });
      } catch (err: any) {
        res.status(500).json({ message: `PDF upload failed: ${err.message}` });
      }
    });
  });

  app.post("/api/upload/file", isAuthenticated, (req: any, res: any) => {
    anyUpload.single("file")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No file received. Field name: 'file'" });
      try {
        const mime = req.file.mimetype;
        const isVideo = mime.startsWith("video/");
        const isImage = mime.startsWith("image/");
        const resourceType = isVideo ? "video" : isImage ? "image" : "raw";
        const folder = isVideo ? "vid-x/videos" : isImage ? "vid-x/images" : "vid-x/files";
        const result = await uploadToCloudinary(req.file.buffer, resourceType, folder);
        res.json({
          success: true,
          url: result.url,
          videoUrl: isVideo ? result.url : undefined,
          imageUrl: isImage ? result.url : undefined,
          pdfUrl: (!isVideo && !isImage) ? result.url : undefined,
          publicId: result.publicId,
          type: resourceType,
        });
      } catch (err: any) {
        res.status(500).json({ message: `Upload failed: ${err.message}` });
      }
    });
  });

  app.post("/api/upload/book-pdf", isAuthenticated, (req: any, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    bookUpload.single("pdf")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message || "File rejected" });
      if (!req.file) return res.status(400).json({ message: "No file received" });
      try {
        const result = await uploadToCloudinary(req.file.buffer, "auto", "vid-x-books");
        res.json({ pdfUrl: result.url });
      } catch (err: any) {
        res.status(500).json({ message: `Upload failed: ${err.message}` });
      }
    });
  });

  const chunkUpload = multer({ storage: multer.memoryStorage() });
  const chunksDir = path.join(process.cwd(), "uploads", "chunks");
  if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });

  app.post("/api/upload/chunk", isAuthenticated, (req: any, res: any) => {
    chunkUpload.single("chunk")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No chunk received" });
      try {
        const { uploadId, chunkIndex, totalChunks } = req.body;
        if (!uploadId || chunkIndex === undefined || !totalChunks)
          return res.status(400).json({ message: "Missing uploadId, chunkIndex, or totalChunks" });
        const idx = Number(chunkIndex);
        const chunkPath = path.join(chunksDir, `${uploadId}-${idx}`);
        fs.writeFileSync(chunkPath, req.file.buffer);
        res.json({ success: true, chunkIndex: idx });
      } catch (err: any) {
        res.status(500).json({ message: `Chunk save failed: ${err.message}` });
      }
    });
  });

  app.post("/api/upload/finalize", isAuthenticated, async (req: any, res: any) => {
    try {
      const { uploadId, totalChunks, originalName } = req.body;
      if (!uploadId || !totalChunks || !originalName)
        return res.status(400).json({ message: "Missing uploadId, totalChunks, or originalName" });
      const total = Number(totalChunks);
      for (let i = 0; i < total; i++) {
        const chunkPath = path.join(chunksDir, `${uploadId}-${i}`);
        if (!fs.existsSync(chunkPath))
          return res.status(400).json({ message: `Missing chunk ${i}. Please retry the upload.` });
      }
      const buffers: Buffer[] = [];
      for (let i = 0; i < total; i++) buffers.push(fs.readFileSync(path.join(chunksDir, `${uploadId}-${i}`)));
      const fullBuffer = Buffer.concat(buffers);
      for (let i = 0; i < total; i++) {
        try { fs.unlinkSync(path.join(chunksDir, `${uploadId}-${i}`)); } catch {}
      }
      const result = await uploadToCloudinary(fullBuffer, "video", "vid-x/videos");
      res.json({ success: true, url: result.url, videoUrl: result.url, publicId: result.publicId });
    } catch (err: any) {
      res.status(500).json({ message: `Finalize failed: ${err.message}` });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/users/check-email", async (req, res) => {
    try {
      const email = ((req.query.email as string) || "").toLowerCase().trim();
      if (!email) return res.status(400).json({ message: "Email is required" });
      const found = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (!found.length) return res.status(404).json({ message: "No account found with that email address" });
      res.json({ exists: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, newPassword } = req.body as { email?: string; newPassword?: string };
      if (!email || !newPassword) return res.status(400).json({ message: "Email and new password are required" });
      if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      const found = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
      if (!found.length) return res.status(404).json({ message: "No account found with that email address" });
      const bcrypt = await import("bcryptjs");
      const hashed = await bcrypt.hash(newPassword, 10);
      await db.update(users).set({ password: hashed }).where(eq(users.email, email.toLowerCase().trim()));
      res.json({ message: "Password updated successfully" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email) return res.status(400).json({ message: "Email required" });
      const found = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
      if (!found.length) return res.status(404).json({ message: "No account found" });
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);
      await db.execute(sql`
        INSERT INTO otp_tokens (email, otp, expires_at)
        VALUES (${email.toLowerCase().trim()}, ${otp}, ${expiry})
        ON CONFLICT (email) DO UPDATE SET otp = ${otp}, expires_at = ${expiry}
      `);
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: `"VID-X" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Your VID-X Password Reset Code",
        html: `
          <div style="background:#1a1a1a;padding:40px;font-family:Arial;max-width:600px;margin:0 auto;border-radius:16px;border:1px solid #ff2d55;">
            <h1 style="background:linear-gradient(90deg,#ff2d55,#ff6b9d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:32px;font-weight:900;margin:0 0 8px;">VID-X</h1>
            <p style="color:#9b9b9b;font-size:14px;">The next generation social platform</p>
            <hr style="border:1px solid #2a2a2a;margin:20px 0;">
            <p style="color:#ffffff;font-size:16px;">Your Password Reset Code:</p>
            <div style="background:linear-gradient(90deg,#ff2d55,#f97316);border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
              <h1 style="color:white;font-size:42px;font-weight:900;letter-spacing:12px;margin:0;">${otp}</h1>
            </div>
            <p style="color:#ff6b9d;font-size:13px;">⏱ Valid for 10 minutes only</p>
            <p style="color:#9b9b9b;font-size:12px;">If you didn't request this, ignore this email.</p>
            <p style="color:#ff2d55;font-weight:bold;margin-top:20px;">— VID-X Team</p>
          </div>
        `,
      });
      res.json({ message: "OTP sent" });
    } catch (err: any) {
      console.error("[forgot-password]", err.message);
      res.status(500).json({ message: err.message || "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-reset-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });
      const result = await db.execute(sql`
        SELECT * FROM otp_tokens 
        WHERE email = ${email.toLowerCase().trim()} 
        AND otp = ${otp}
        AND expires_at > NOW()
        LIMIT 1
      `);
      const rows = (result as any).rows ?? result;
      if (!rows.length) return res.status(400).json({ message: "Invalid or expired OTP" });
      await db.execute(sql`DELETE FROM otp_tokens WHERE email = ${email.toLowerCase().trim()}`);
      res.json({ message: "OTP verified" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  });

  app.post("/api/user/goal", isAuthenticated, async (req, res) => {
    try {
      const goal = (req.body.goal as string || "").trim();
      if (!goal) return res.status(400).json({ message: "Goal is required" });
      const userId = (req.session as any).userId;
      await db.update(users).set({ goal, goalSetAt: new Date() }).where(eq(users.id, userId));
      res.json({ goal });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  });

  app.get("/api/user/goal", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const found = await db.select({ goal: users.goal }).from(users).where(eq(users.id, userId)).limit(1);
      if (!found.length) return res.status(404).json({ message: "User not found" });
      res.json({ goal: found[0].goal });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  });

  app.get("/api/config", (_req, res) => {
    res.json({
      cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
      cloudinaryUploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "",
    });
  });

  const SERVER_START_TIME = Date.now().toString();
  app.get("/api/version", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ v: SERVER_START_TIME });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.get(api.posts.list.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const allPosts = await storage.getAllPosts();
      const blockedPosts = await db.select({ postId: pendingBlocks.postId }).from(pendingBlocks)
        .where(and(eq(pendingBlocks.blockedUserId, userId), sql`${pendingBlocks.blockUntil} > CURRENT_TIMESTAMP`));
      const blockedPostIds = new Set(blockedPosts.map(b => b.postId));
      const filteredPosts = allPosts.filter(post => !blockedPostIds.has(post.id));
      const enrichedPosts = await Promise.all(filteredPosts.map(async (post) => {
        const user = await authStorage.getUser(post.userId);
        const likesCount = await storage.getLikesCount(post.id);
        const comms = await storage.getComments(post.id);
        const hasLiked = await storage.hasLiked(post.id, userId);
        const savedCheck = await db.select().from(savedPosts)
          .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, post.id))).limit(1);
        return { ...post, user, likesCount, commentsCount: comms.length, hasLiked, hasSaved: savedCheck.length > 0 };
      }));
      res.json(enrichedPosts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post(api.posts.create.path, isAuthenticated, async (req, res) => {
    try {
      const post = await storage.createPost({ ...req.body, userId: (req.session as any).userId });
      res.status(201).json(post);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get(api.posts.get.path, isAuthenticated, async (req, res) => {
    try {
      const post = await storage.getPost(Number(req.params.id));
      if (!post) return res.status(404).json({ message: "Post not found" });
      const user = await authStorage.getUser(post.userId);
      const likesCount = await storage.getLikesCount(post.id);
      const comms = await storage.getComments(post.id);
      const hasLiked = await storage.hasLiked(post.id, (req.session as any).userId);
      res.json({ ...post, user, likesCount, commentsCount: comms.length, hasLiked });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post(api.posts.like.path, isAuthenticated, async (req, res) => {
    try {
      const postId = Number(req.params.id);
      const userId = (req.session as any).userId;
      const { added, count } = await storage.toggleLike(postId, userId);
      if (added) {
        const post = await storage.getPost(postId);
        if (post && post.userId !== userId) {
          const liker = await authStorage.getUser(userId);
          await db.insert(notifications).values({
            userId: post.userId, fromUserId: userId, type: "like",
            message: `${liker?.firstName ?? "Someone"} liked your post`, postId,
          });
        }
      }
      res.json({ success: true, likesCount: count, added });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post(api.posts.comment.path, isAuthenticated, async (req, res) => {
    try {
      const postId = Number(req.params.id);
      const userId = (req.session as any).userId;
      const { content } = req.body;
      if (!content) return res.status(400).json({ message: "Content required" });
      const comment = await storage.createComment(postId, userId, content);
      res.status(201).json(comment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/posts/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const postId = Number(req.params.id);
      const userId = (req.session as any).userId;
      const { content } = req.body;
      if (!content) return res.status(400).json({ message: "Comment empty" });
      const comment = await storage.createComment(postId, userId, content);
      const post = await storage.getPost(postId);
      if (post && post.userId !== userId) {
        const sender = await authStorage.getUser(userId);
        await db.insert(notifications).values({
          userId: post.userId, fromUserId: userId, type: "comment",
          message: `${sender?.firstName || "Someone"} commented on your post`, postId,
        });
      }
      res.status(201).json(comment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/posts/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const postId = Number(req.params.id);
      const commentList = await storage.getComments(postId);
      const withUsers = await Promise.all(commentList.map(async (c) => {
        const u = await authStorage.getUser(c.userId);
        return { ...c, user: u ? { firstName: u.firstName, lastName: u.lastName, profileImageUrl: u.profileImageUrl } : null };
      }));
      res.json(withUsers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/posts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const postId = Number(req.params.id);
      const deleted = await storage.deletePost(postId, userId);
      if (!deleted) return res.status(403).json({ message: "Not allowed or post not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/posts/:id/save", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const postId = Number(req.params.id);
      const existing = await db.select().from(savedPosts)
        .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId))).limit(1);
      if (existing.length > 0) {
        await db.delete(savedPosts).where(eq(savedPosts.id, existing[0].id));
        return res.json({ saved: false });
      } else {
        await db.insert(savedPosts).values({ userId, postId });
        return res.json({ saved: true });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/posts/:id/report", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const postId = Number(req.params.id);
      const { reason } = req.body;
      await db.insert(reports).values({ reportedPostId: postId, reporterId: userId, reason: reason || "Inappropriate Content" });
      const post = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
      if (post.length === 0) return res.status(404).json({ message: "Post not found" });
      const postAuthorId = post[0].userId;
      const blockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);
      await db.insert(pendingBlocks).values({
        postId, reportedUserId: postAuthorId, blockedUserId: userId,
        reason: reason || "Reported content", blockUntil,
      });
      await db.insert(notifications).values({
        userId, type: "report_submitted",
        message: "Your report has been submitted. This user's content will be blocked for 2 hours.",
        createdAt: new Date(),
      });
      res.json({ success: true, blockUntil });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/posts/:id/view", isAuthenticated, async (req, res) => {
    try {
      const postId = Number(req.params.id);
      await db.execute(sql`UPDATE posts SET viewer_count = viewer_count + 1 WHERE id = ${postId}`);
      const row = await db.execute(sql`SELECT viewer_count FROM posts WHERE id = ${postId}`);
      const viewerCount = parseInt(((row as any).rows?.[0] ?? (row as any)[0])?.viewer_count ?? "0");
      res.json({ viewerCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BOOKS ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/books", isAuthenticated, async (req, res) => {
    try {
      const type = req.query.type as string;
      const books = await storage.getBooks(type);
      res.json(books);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/books", isAuthenticated, async (req, res) => {
    try {
      const book = await storage.createBook({
        ...req.body,
        content: req.body.pdfUrl ? "" : (req.body.content || ""),
      });
      res.status(201).json(book);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // USER ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const allUsers = await db.select().from(users);
      const me = (req.session as any).userId;
      res.json(allUsers.filter(u => u.id !== me).map(u => ({
        id: u.id, firstName: u.firstName, lastName: u.lastName,
        username: u.username, profileImageUrl: u.profileImageUrl, bio: (u as any).bio,
      })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/search", isAuthenticated, async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").toLowerCase().trim();
      const allUsers = await db.select().from(users);
      const me = (req.session as any).userId;
      const filtered = allUsers.filter(u => u.id !== me && (
        !q || (u.firstName + " " + u.lastName).toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q)
      ));
      res.json(filtered.map(u => ({
        id: u.id, firstName: u.firstName, lastName: u.lastName,
        username: u.username, profileImageUrl: u.profileImageUrl, bio: (u as any).bio,
      })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const user = await authStorage.getUser(String(req.params.id));
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = user as any;
      const followersRow = await db.execute(sql`SELECT COUNT(*) AS cnt FROM follows WHERE following_id = ${req.params.id}`);
      const followingRow = await db.execute(sql`SELECT COUNT(*) AS cnt FROM follows WHERE follower_id = ${req.params.id}`);
      const postsRow = await db.execute(sql`SELECT COUNT(*) AS cnt FROM posts WHERE user_id = ${req.params.id} AND type NOT IN ('live', 'story')`);
      const followersCount = parseInt(((followersRow as any).rows ?? followersRow as any)[0]?.cnt ?? "0");
      const followingCount = parseInt(((followingRow as any).rows ?? followingRow as any)[0]?.cnt ?? "0");
      const postsCount = parseInt(((postsRow as any).rows ?? postsRow as any)[0]?.cnt ?? "0");
      res.json({ ...safeUser, followersCount, followingCount, postsCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = user as any;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { firstName, lastName, username, bio, profileImageUrl, pet } = req.body;
      const existing = await authStorage.getUser(userId);
      if (!existing) return res.status(404).json({ message: "User not found" });
      if (username && username !== (existing as any).username) {
        const taken = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
        if (taken.length > 0 && taken[0].id !== userId) return res.status(409).json({ message: "Username already taken." });
      }
      const updated = await authStorage.upsertUser({
        ...existing,
        firstName: firstName ?? existing.firstName,
        lastName: lastName ?? existing.lastName,
        username: username ?? (existing as any).username,
        bio: bio ?? (existing as any).bio,
        profileImageUrl: profileImageUrl ?? existing.profileImageUrl,
        pet: pet ?? (existing as any).pet,
      });
      const { password: _, ...safeUser } = updated as any;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FOLLOW ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/users/:id/follow", isAuthenticated, async (req: any, res) => {
    try {
      const followerId = req.session.userId;
      const followingId = req.params.id;
      if (followerId === followingId) return res.status(400).json({ message: "Cannot follow yourself" });
      await db.execute(sql`INSERT INTO follows (follower_id, following_id) VALUES (${followerId}, ${followingId}) ON CONFLICT DO NOTHING`);
      const follower = await authStorage.getUser(followerId);
      await db.insert(notifications).values({
        userId: followingId, fromUserId: followerId, type: "follow",
        message: `${follower?.firstName ?? "Someone"} started following you`,
      });
      res.json({ following: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/users/:id/follow", isAuthenticated, async (req: any, res) => {
    try {
      const followerId = req.session.userId;
      const followingId = req.params.id;
      await db.execute(sql`DELETE FROM follows WHERE follower_id = ${followerId} AND following_id = ${followingId}`);
      res.json({ following: false });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/follow-status", isAuthenticated, async (req: any, res) => {
    try {
      const rows = await db.execute(sql`SELECT id FROM follows WHERE follower_id = ${req.session.userId} AND following_id = ${req.params.id} LIMIT 1`);
      res.json({ following: ((rows as any).rows ?? rows as any).length > 0 });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/followers", isAuthenticated, async (req, res) => {
    try {
      const rows = await db.execute(sql`SELECT follower_id FROM follows WHERE following_id = ${req.params.id}`);
      const ids = ((rows as any).rows ?? rows as any).map((r: any) => r.follower_id);
      const followerUsers = await Promise.all(ids.map((id: string) => authStorage.getUser(id)));
      res.json(followerUsers.filter(Boolean));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/following", isAuthenticated, async (req, res) => {
    try {
      const rows = await db.execute(sql`SELECT following_id FROM follows WHERE follower_id = ${req.params.id}`);
      const ids = ((rows as any).rows ?? rows as any).map((r: any) => r.following_id);
      const followingUsers = await Promise.all(ids.map((id: string) => authStorage.getUser(id)));
      res.json(followingUsers.filter(Boolean));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Post pe kisne like kiya - list
app.get("/api/posts/:id/likes", isAuthenticated, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const result = await db.execute(sql`
      SELECT u.id, u.first_name, u.last_name, u.username, u.profile_image_url
      FROM likes l
      JOIN users u ON u.id = l.user_id
      WHERE l.post_id = ${postId}
      ORDER BY l.id DESC
    `);
    const rows = (result as any).rows ?? result;
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});


  // ══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rows = await db.execute(sql`
        SELECT n.*, u.first_name, u.last_name, u.username, u.profile_image_url
        FROM notifications n
        LEFT JOIN users u ON u.id = n.from_user_id
        WHERE n.user_id = ${userId}
        ORDER BY n.created_at DESC LIMIT 50
      `);
      res.json((rows as any).rows ?? rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      await db.execute(sql`UPDATE notifications SET read = true WHERE user_id = ${req.session.userId}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const rows = await db.execute(sql`SELECT COUNT(*) as count FROM notifications WHERE user_id = ${req.session.userId} AND read = false`);
      const count = parseInt(((rows as any).rows?.[0] ?? (rows as any)[0])?.count ?? "0");
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // DIRECT CHAT ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/direct-chats", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const chats = await storage.getDirectChats(userId);
    const enriched = await Promise.all(chats.map(async chat => {
      const otherId = chat.user1Id === userId ? chat.user2Id : chat.user1Id;
      const otherUser = await authStorage.getUser(otherId);
      const msgs = await storage.getDirectMessages(chat.id);
      const lastMsg = msgs[msgs.length - 1] ?? null;
      const unread = msgs.filter(m => m.senderId !== userId && !m.readAt).length;
      const onlineStatus = await storage.getOnlineStatus(otherId);
      return { ...chat, otherUser, lastMsg, unread, isOnline: onlineStatus.isOnline, lastSeen: onlineStatus.lastSeen };
    }));
    res.json(enriched);
  });

  app.post("/api/direct-chats", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const { otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ message: "otherUserId required" });
    const chat = await storage.getOrCreateDirectChat(userId, otherUserId);
    res.json(chat);
  });

  app.patch("/api/direct-chats/:id/theme", isAuthenticated, async (req, res) => {
    await storage.updateChatTheme(Number(req.params.id), req.body.theme);
    res.json({ ok: true });
  });

  app.get("/api/direct-chats/:id/messages", isAuthenticated, async (req, res) => {
    const msgs = await storage.getDirectMessages(Number(req.params.id));
    res.json(msgs);
  });

  app.post("/api/direct-chats/:id/messages", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const chatId = Number(req.params.id);
    const { content, type, mediaUrl, metadata, replyToId, expiresInSeconds } = req.body;
    const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : undefined;

    const msg = await storage.sendDirectMessage({
      chatId, senderId: userId, content,
      type: type || "text", mediaUrl, metadata, replyToId,
      ...(expiresAt ? { expiresAt } : {}),
    });

    res.status(201).json(msg);

    try {
      const chatRows = await db.execute(sql`SELECT user1_id, user2_id FROM direct_chats WHERE id = ${chatId}`);
      const chatRow = ((chatRows as any).rows ?? chatRows as any)[0];
      if (chatRow) {
        const recipientId = chatRow.user1_id === userId ? chatRow.user2_id : chatRow.user1_id;
        const sender = await authStorage.getUser(userId);
    let preview = "";
try {
  const parsed = JSON.parse(content ?? "");
  if (parsed?.e2e) {
    preview = "sent you a message"; // encrypted msg ka preview
  } else {
    preview = (content ?? "").slice(0, 50);
  }
} catch {
  preview = (content ?? "").slice(0, 50);
}
        await db.execute(sql`
          INSERT INTO notifications (user_id, from_user_id, type, message)
          VALUES (${recipientId}, ${userId}, 'message',
          ${`${sender?.firstName ?? "Someone"} sent you a message${preview ? `: "${preview}"` : ""}`})
        `);
        const receiverWs = wsClients.get(String(recipientId));
        if (receiverWs && receiverWs.readyState === 1) {
          receiverWs.send(JSON.stringify({ type: "new_message", chatId, message: msg }));
        }
      }
    } catch (e) {
      console.error("[direct-chat message] background error:", e);
    }
  });

  app.patch("/api/direct-chats/:id/read", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    await storage.markMessagesRead(Number(req.params.id), userId);
    res.json({ ok: true });
  });

  app.patch("/api/messages/:id/react", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const { emoji } = req.body;
    const msg = await storage.addReaction(Number(req.params.id), userId, emoji);
    res.json(msg);
  });

  app.patch("/api/messages/:id/pin", isAuthenticated, async (req, res) => {
    const { pinned } = req.body;
    const msg = await storage.pinMessage(Number(req.params.id), pinned);
    res.json(msg);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ✅ FIX 1: Single message delete — res.json() sirf ek baar
  // Cloudinary se bhi media delete hoga
  // ══════════════════════════════════════════════════════════════════════════
  app.delete("/api/messages/:id", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const messageId = Number(req.params.id);

    try {
      // Message fetch karo (chatId + mediaUrl ke liye)
      const msgRows = await db.execute(
        sql`SELECT * FROM direct_messages WHERE id = ${messageId} LIMIT 1`
      );
      const msgRow = ((msgRows as any).rows ?? msgRows as any)[0];

      if (!msgRow) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Cloudinary se media delete karo (agar image/video hai)
      if (msgRow.media_url && msgRow.type !== "text" && msgRow.type !== "voice") {
        deleteFromCloudinary(msgRow.media_url).catch(err =>
          console.error("[delete message] Cloudinary cleanup error:", err)
        );
      }

      // DB se delete karo
      await storage.deleteMessage(messageId);

      // ✅ SIRF EK BAAR res.json() — yahi bug tha
      res.json({ success: true, id: messageId });

      // Background: WebSocket broadcast (response already sent hai)
      try {
        const chatRows = await db.execute(
          sql`SELECT user1_id, user2_id FROM direct_chats WHERE id = ${msgRow.chat_id} LIMIT 1`
        );
        const chatRow = ((chatRows as any).rows ?? chatRows as any)[0];
        if (chatRow) {
          const otherUserId = chatRow.user1_id === userId ? chatRow.user2_id : chatRow.user1_id;
          [wsClients.get(String(userId)), wsClients.get(String(otherUserId))].forEach(ws => {
            if (ws && ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: "delete_message",
                messageId,
                chatId: msgRow.chat_id,
              }));
            }
          });
        }
      } catch (wsErr) {
        console.error("[delete message] WebSocket error:", wsErr);
      }

    } catch (err: any) {
      console.error("[delete message] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: err.message || "Delete failed" });
      }
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ✅ FIX 2: Clear all chat — naya route (pehle exist nahi tha)
  // Cloudinary se saari media bhi delete hogi
  // ══════════════════════════════════════════════════════════════════════════
  app.delete("/api/direct-chats/:id/messages", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const chatId = Number(req.params.id);

    try {
      // Verify: current user is part of this chat
      const chatRows = await db.execute(
        sql`SELECT user1_id, user2_id FROM direct_chats WHERE id = ${chatId} LIMIT 1`
      );
      const chatRow = ((chatRows as any).rows ?? chatRows as any)[0];

      if (!chatRow) {
        return res.status(404).json({ message: "Chat not found" });
      }

      if (chatRow.user1_id !== userId && chatRow.user2_id !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Saare media files fetch karo Cloudinary cleanup ke liye
      const allMsgs = await db.execute(
        sql`SELECT media_url, type FROM direct_messages WHERE chat_id = ${chatId} AND media_url IS NOT NULL`
      );
      const mediaRows = ((allMsgs as any).rows ?? allMsgs as any);

      // Cloudinary se saari media delete karo (background mein)
      mediaRows
        .filter((m: any) => m.media_url && m.type !== "text" && m.type !== "voice")
        .forEach((m: any) => {
          deleteFromCloudinary(m.media_url).catch(err =>
            console.error("[clear chat] Cloudinary cleanup error:", err)
          );
        });

      // DB se saare messages delete karo
      await db.execute(sql`DELETE FROM direct_messages WHERE chat_id = ${chatId}`);

      res.json({ success: true, chatId });

      // WebSocket: dono users ko batao
      try {
        const otherUserId = chatRow.user1_id === userId ? chatRow.user2_id : chatRow.user1_id;
        [wsClients.get(String(userId)), wsClients.get(String(otherUserId))].forEach(ws => {
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "clear_chat", chatId }));
          }
        });
      } catch (wsErr) {
        console.error("[clear chat] WebSocket error:", wsErr);
      }

    } catch (err: any) {
      console.error("[clear chat] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: err.message || "Clear failed" });
      }
    }
  });

  app.post("/api/direct-chats/:id/typing", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    await storage.setTyping(userId, Number(req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/direct-chats/:id/typing", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const typers = await storage.getTyping(Number(req.params.id), userId);
    res.json({ typers });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LIVE STREAM ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/live/start", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { title, thumbnail } = req.body;
      const post = await storage.createPost({
        userId,
        imageUrl: thumbnail || `https://api.dicebear.com/7.x/shapes/svg?seed=${userId}`,
        caption: title || "Live Stream",
        type: "live",
      });
      res.json({ post, viewerCount: 0 });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/live/end/:postId", isAuthenticated, async (req, res) => {
    try {
      await db.execute(sql`UPDATE posts SET type = 'video', live_ended_at = NOW() WHERE id = ${Number(req.params.postId)}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/live/active", isAuthenticated, async (_req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT p.*, u.first_name, u.last_name, u.username, u.profile_image_url
        FROM posts p JOIN users u ON u.id = p.user_id
        WHERE p.type = 'live' ORDER BY p.created_at DESC
      `);
      res.json((rows as any).rows ?? rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/live/:postId/viewers", isAuthenticated, async (req, res) => {
    try {
      const row = await db.execute(sql`SELECT viewer_count FROM posts WHERE id = ${Number(req.params.postId)}`);
      const viewerCount = parseInt(((row as any).rows?.[0] ?? (row as any)[0])?.viewer_count ?? "0");
      res.json({ viewerCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // HISTORY & ADS
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/history", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const history = await storage.getHistory(userId);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/history", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const entry = await storage.createHistory({ ...req.body, userId });
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/ads/:placement", isAuthenticated, async (req, res) => {
    try {
      const placement = req.params.placement as string;
      const adsList = await storage.getAdsByPlacement(placement);
      res.json(adsList);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // AI / GEMINI ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/translate", isAuthenticated, async (req, res) => {
    const { text, targetLang } = req.body;
    if (!text) return res.status(400).json({ message: "text required" });
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not defined in environment variables.");
      const genAI = new GoogleGenerativeAI(apiKey);
      const { result } = await generateGeminiContent(genAI, `Translate to ${targetLang || "English"}. Reply with only translated text:\n\n${text}`);
      res.json({ translated: result.response.text() || "" });
    } catch (err: any) {
      console.error("[translate] Gemini error:", err.message);
      res.status(500).json({ message: "Translation failed" });
    }
  });

  app.post("/api/smart-reply", isAuthenticated, async (req, res) => {
    const { lastMessage } = req.body;
    if (!lastMessage) return res.status(400).json({ message: "lastMessage required" });
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not defined in environment variables.");
      const genAI = new GoogleGenerativeAI(apiKey);
      const { result } = await generateGeminiContent(genAI, `Generate 3 short reply suggestions for: "${lastMessage}". Reply with JSON array of strings only.`);
      const raw = result.response.text() ?? "[]";
      const suggestions = JSON.parse(raw.replace(/```json|```/g, "").trim());
      res.json({ suggestions });
    } catch (err: any) {
      console.error("[smart-reply] Gemini error:", err?.message || err);
      res.json({ suggestions: ["👍", "Got it!", "Thanks!"] });
    }
  });

  return httpServer;
}