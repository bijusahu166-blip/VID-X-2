


import {
  users, posts, comments, savedPosts, reports, notifications, conversations, messages,
  pendingBlocks, blocks, follows, directChats, directMessages,
  restrictedAccounts, hiddenWords, closeFriends, postDrafts, scheduledPosts,
  profileViews, loginSessions, adPreferences
} from "@shared/schema";
import { db } from "./db";
import { sql, eq, desc, and, or } from "drizzle-orm";
import { generateAgoraToken } from "./agora";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authStorage } from "./replit_integrations/auth/storage";
import { setupAuth, registerAuthRoutes, registerSmsOtpRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerChatRoutes } from "./replit_integrations/chat";
import { api } from "@shared/routes";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";  // 👈 DeleteObjectCommand add karo import mein
import { wsClients } from "./realtime";


// --- CONFIGURATION ---
const uploadsDir = path.join(process.cwd(), "uploads", "videos");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
// ── Cloudflare R2 (S3-compatible) ──
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
async function uploadToR2(
  buffer: Buffer,
  folder: string,
  originalName: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  const ext = originalName.split(".").pop() || "bin";
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return { url: `${process.env.R2_PUBLIC_URL}/${key}`, key };
} 
async function deleteFromR2(mediaUrl: string): Promise<void> {
  try {
    if (!process.env.R2_PUBLIC_URL || !mediaUrl.startsWith(process.env.R2_PUBLIC_URL)) return; // R2 ka URL nahi hai, skip
    const key = mediaUrl.replace(`${process.env.R2_PUBLIC_URL}/`, "");
    await r2.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    }));
  } catch (err) {
    console.error("[R2 delete] Error:", err);
  }
}
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
// For large video buffers (>50MB), use Cloudinary's chunked upload_large
// instead of upload_stream — avoids 413 errors from proxies/load balancers
// by sending the buffer to Cloudinary in 6MB chunks rather than one big request.
async function uploadLargeVideoToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<{ url: string; publicId: string; format: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");
    const tempPath = path.join(os.tmpdir(), `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`);
    fs.writeFileSync(tempPath, buffer);

  cloudinary.uploader.upload_large(
  tempPath,
  {
    resource_type: "video",
    folder,
    public_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    overwrite: false,
    chunk_size: 6 * 1024 * 1024,
   
  },
      (error: any, result: any) => {
        try { fs.unlinkSync(tempPath); } catch {}
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );
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

// ── Raw SQL rows snake_case return karta hai, frontend camelCase expect karta hai ──
function mapPostRow(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    imageUrl: row.image_url,
    caption: row.caption,
    type: row.type,
    videoUrl: row.video_url,
    createdAt: row.created_at,
    liveEndedAt: row.live_ended_at,
    viewerCount: row.viewer_count,
    songTitle: row.song_title,
    songArtist: row.song_artist,
    songColor: row.song_color,
  };
}

function mapStoryRow(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    mediaUrl: row.media_url,
    type: row.type ?? "image",
    caption: row.caption ?? null,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    viewerCount: row.viewer_count ?? 0,
    user: row.username
      ? {
          id: String(row.user_id),
          firstName: row.first_name ?? null,
          lastName: row.last_name ?? null,
          username: row.username ?? null,
          profileImageUrl: row.profile_image_url ?? null,
        }
      : undefined,
  };
}

function mapJobRow(row: any) {
  return {
    ...row,
    userId: row.user_id ?? null,
    jobType: row.job_type ?? row.type ?? "Full-time",
    type: row.job_type ?? row.type ?? "Full-time",
    imageUrl: row.image_url ?? null,
    applyUrl: row.apply_url ?? null,
    postedAt: row.posted_at ?? row.created_at ?? "",
    ejsPubkey: row.ejs_pubkey ?? "",
    ejsService: row.ejs_service ?? "",
    ejsTemplate: row.ejs_template ?? "",
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

// ── Expired stories cleanup — har 15 min mein chalega ──
setInterval(async () => {
  try {
    const expiredRows = await db.execute(sql`
      SELECT id, media_url FROM stories WHERE expires_at <= NOW()
    `);
    const expired = (expiredRows as any).rows ?? expiredRows;

    for (const story of expired) {
      await db.execute(sql`DELETE FROM story_likes WHERE story_id = ${story.id}`);
      await db.execute(sql`DELETE FROM story_comments WHERE story_id = ${story.id}`);
      await db.execute(sql`DELETE FROM stories WHERE id = ${story.id}`);

      if (story.media_url) {
        // Dono try karo — jo bhi storage se file hai, wahi se delete ho jayegi.
        // R2_PUBLIC_URL match na kare to deleteFromR2 apne aap skip kar deta hai.
        deleteFromR2(story.media_url).catch(() => {});
        deleteFromCloudinary(story.media_url).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[expired stories cleanup]", err);
  }
}, 15 * 60 * 1000);
// ── Auto-delete read direct messages after 10 minutes ──
setInterval(async () => {
  try {
    await db.execute(sql`
      DELETE FROM direct_messages
      WHERE read_at IS NOT NULL
        AND read_at < NOW() - INTERVAL '10 minutes'
    `);
  } catch (err) {
    console.error("[auto-delete read messages]", err);
  }
}, 5 * 60 * 1000);
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

// --- AUTO-DELETE OLD COMMENTS (90 Days) ---
setInterval(async () => {
  try {
    const result = await db.execute(sql`
      DELETE FROM comments WHERE created_at < NOW() - INTERVAL '90 days'
    `);
    console.log(`[comments cleanup] Deleted old comments`);
  } catch (err) {
    console.error("[comments cleanup error]", err);
  }
}, 24 * 60 * 60 * 1000); 

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
  async function ensureUserPreferenceColumns() {
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive'`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50)`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference VARCHAR(10) DEFAULT 'en'`);
    } catch (error) {
      console.error("[user columns]", error);
    }
  }

  await ensureUserPreferenceColumns();
 // ── JOBS TABLE ───────────────────────────────────────────────────────────
async function ensureJobsTable() {
  try {
    // Table doesn't exist -> create it.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY
      )
    `);

    // Existing old jobs table ho to missing columns automatically add karo.
    // user_id nullable rakha hai because old jobs may already exist.
    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS title VARCHAR(180) NOT NULL DEFAULT ''
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS company VARCHAR(180) NOT NULL DEFAULT ''
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS email VARCHAR(255) NOT NULL DEFAULT ''
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS pin VARCHAR(10) NOT NULL DEFAULT ''
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS location VARCHAR(180) NOT NULL DEFAULT 'Remote'
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS salary VARCHAR(120) NOT NULL DEFAULT 'Negotiable'
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS type VARCHAR(80) NOT NULL DEFAULT 'Full-time'
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS job_type VARCHAR(80) NOT NULL DEFAULT 'Full-time'
    `);

    await db.execute(sql`
      UPDATE jobs
      SET job_type = COALESCE(NULLIF(job_type, ''), NULLIF(type, ''), 'Full-time')
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS emoji VARCHAR(20) NOT NULL DEFAULT '💼'
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS ejs_pubkey TEXT NOT NULL DEFAULT ''
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS ejs_service TEXT NOT NULL DEFAULT ''
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS ejs_template TEXT NOT NULL DEFAULT ''
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS image_url TEXT
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS apply_url TEXT
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS posted_at VARCHAR(50)
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()
    `);

    await db.execute(sql`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    `);

    // Indexes only AFTER all columns definitely exist.
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS jobs_active_created_idx
      ON jobs (active, created_at DESC)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS jobs_user_idx
      ON jobs (user_id)
    `);

    console.log("[jobs table] ready");
  } catch (error) {
    // Don't kill the whole app if jobs setup has a DB problem.
    console.error("[jobs table] setup error:", error);
  }
}

await ensureJobsTable();
  // Permanent Voice Room unlock
async function ensureVoiceRoomUnlockColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS voice_room_unlocked BOOLEAN DEFAULT FALSE
    `);
  } catch (error) {
    console.error("[voice room unlock column]", error);
  }
}

await ensureVoiceRoomUnlockColumn();

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  registerAuthRoutes(app);
  registerSmsOtpRoutes(app);
  registerChatRoutes(app);

  const settingsRoutes = await import('./routes/settings');
  const messagesRoutes = await import('./routes/messages');
  app.use('/api/settings', settingsRoutes.default);
  app.use('/api/messages', messagesRoutes.default);

  app.post('/api/ai/chat', isAuthenticated, async (req: any, res: any) => {
    try {
      const message = String(req.body?.message || '').trim();
      if (!message) {
        return res.status(400).json({ reply: 'Please enter a message first.' });
      }

      const isHindi = /[अआइईउऊएओऐऔकखगघचछजझटठडढतथदधनपफबभमयरलवशषसह]/.test(message) || /है|कृपया|क्या|कैसे|मुझे|मैं/.test(message);
      const reply = isHindi
        ? `मैंने आपका संदेश समझ लिया है: "${message}". प्रो सब्सक्रिप्शन लेने पर आप बेहतर, गहरे और प्रीमियम चैट अनुभव पा सकते हैं.`
        : `I received your message: "${message}". Pro access unlocks richer premium chat responses and a more polished experience.`;

      res.json({ reply });
    } catch (error: any) {
      console.error('[ai chat]', error);
      res.status(500).json({ reply: 'The chat service is unavailable right now. Please try again shortly.' });
    }
  });

  seed().catch(console.error);

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK HELPER (moved above all routes so every route below can use it)
  // ══════════════════════════════════════════════════════════════════════════
  async function isBlockedEitherWay(userA: string, userB: string) {
    const rows = await db.select().from(blocks).where(
      sql`(${blocks.blockerId} = ${userA} AND ${blocks.blockedId} = ${userB})
       OR (${blocks.blockerId} = ${userB} AND ${blocks.blockedId} = ${userA})`
    ).limit(1);
    return rows.length > 0;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPLOAD ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;

  const chunkUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
  });

  const chunksDir = path.join(process.cwd(), "uploads", "chunks");
  if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });

  const uploadByteTotals = new Map<string, number>();
  const uploadTimestamps = new Map<string, number>();
  const CHUNK_TTL_MS = 30 * 60 * 1000;

  setInterval(() => {
    const now = Date.now();
    for (const [id, ts] of uploadTimestamps.entries()) {
      if (now - ts > CHUNK_TTL_MS) {
        uploadByteTotals.delete(id);
        uploadTimestamps.delete(id);
        try {
          const dir = path.join(chunksDir, id);
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        } catch {}
      }
    }
  }, 5 * 60 * 1000);

  app.post("/api/upload/video", isAuthenticated, (req: any, res: any) => {
    anyUpload.single("video")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No video file received" });
      try {
        const result = await uploadToR2(req.file.buffer, "videos", req.file.originalname, req.file.mimetype);
        res.json({ success: true, url: result.url, videoUrl: result.url, publicId: result.key });
      } catch (err: any) {
        res.status(500).json({ message: `Video upload failed: ${err.message}` });
      }
    });
  });

  app.post("/api/upload/image", isAuthenticated, (req: any, res: any) => {
    anyUpload.single("image")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No image file received" });
      try {
      const result = await uploadToR2(req.file.buffer, "images", req.file.originalname, req.file.mimetype);
res.json({ success: true, url: result.url, imageUrl: result.url, publicId: result.key });
      } catch (err: any) {
        res.status(500).json({ message: `Image upload failed: ${err.message}` });
      }
    });
  });

  app.post("/api/upload/profile-image", isAuthenticated, (req: any, res: any) => {
    anyUpload.single("image")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No image received" });
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
      if (!req.file) return res.status(400).json({ message: "No PDF received" });
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
      if (!req.file) return res.status(400).json({ message: "No file received" });
      try {
        const mime = req.file.mimetype;
        const isVideo = mime.startsWith("video/");
        const isImage = mime.startsWith("image/");
        const resourceType = isVideo ? "video" : isImage ? "image" : "raw";
        const folder = isVideo ? "vid-x/videos" : isImage ? "vid-x/images" : "vid-x/files";
        const result = await uploadToCloudinary(req.file.buffer, resourceType, folder);
        res.json({
          success: true, url: result.url,
          videoUrl: isVideo ? result.url : undefined,
          imageUrl: isImage ? result.url : undefined,
          pdfUrl: (!isVideo && !isImage) ? result.url : undefined,
          publicId: result.publicId, type: resourceType,
        });
      } catch (err: any) {
        res.status(500).json({ message: `Upload failed: ${err.message}` });
      }
    });
  });

  app.post("/api/upload/book-pdf", isAuthenticated, (req: any, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    bookUpload.fields([{ name: "pdf", maxCount: 1 }, { name: "file", maxCount: 1 }])(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message || "File rejected" });
      const uploadedFile = (req as any).files?.pdf?.[0] || (req as any).files?.file?.[0];
      if (!uploadedFile) return res.status(400).json({ message: "No file received" });
      try {
        const isPdf = uploadedFile.originalname?.toLowerCase().endsWith(".pdf") ||
          uploadedFile.mimetype === "application/pdf";
        const result = await uploadToCloudinary(uploadedFile.buffer, isPdf ? "raw" : "auto", "vid-x-books");
        res.json({ pdfUrl: result.url, url: result.url });
      } catch (err: any) {
        res.status(500).json({ message: `Upload failed: ${err.message}` });
      }
    });
  });

  app.post("/api/upload/chunk", isAuthenticated, (req: any, res: any) => {
    chunkUpload.single("chunk")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No chunk received" });
      try {
        const { uploadId, chunkIndex, totalChunks } = req.body;
        if (!uploadId || chunkIndex === undefined || !totalChunks)
          return res.status(400).json({ message: "Missing uploadId, chunkIndex, or totalChunks" });
        const idx = Number(chunkIndex);

        const currentTotal = (uploadByteTotals.get(uploadId) ?? 0) + req.file.buffer.length;
        if (currentTotal > MAX_VIDEO_UPLOAD_BYTES) {
          const dir = path.join(chunksDir, uploadId);
          try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); } catch {}
          uploadByteTotals.delete(uploadId);
          uploadTimestamps.delete(uploadId);
          return res.status(413).json({ message: "Video exceeds the 200 MB upload limit." });
        }
        uploadByteTotals.set(uploadId, currentTotal);
        uploadTimestamps.set(uploadId, Date.now());

        const dir = path.join(chunksDir, uploadId);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, String(idx)), req.file.buffer);

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
      const dir = path.join(chunksDir, uploadId);

      if (!fs.existsSync(dir))
        return res.status(400).json({ message: "Upload session expired. Please retry." });

      for (let i = 0; i < total; i++) {
        if (!fs.existsSync(path.join(dir, String(i))))
          return res.status(400).json({ message: `Missing chunk ${i}. Please retry.` });
      }

      const finalPath = path.join(chunksDir, `${uploadId}-final.mp4`);
      const writeStream = fs.createWriteStream(finalPath);
      for (let i = 0; i < total; i++) {
        const chunkPath = path.join(dir, String(i));
        const data = fs.readFileSync(chunkPath);
        writeStream.write(data);
        try { fs.unlinkSync(chunkPath); } catch {}
      }
      await new Promise<void>((resolve, reject) => {
        writeStream.end((err: any) => err ? reject(err) : resolve());
      });
      try { fs.rmdirSync(dir); } catch {}

      uploadByteTotals.delete(uploadId);
      uploadTimestamps.delete(uploadId);

            const stats = fs.statSync(finalPath);
      if (stats.size > MAX_VIDEO_UPLOAD_BYTES) {
        try { fs.unlinkSync(finalPath); } catch {}
        return res.status(413).json({ message: "Video exceeds the 200 MB upload limit." });
      }

      // ✅ R2 upload instead of Cloudinary — read assembled file into buffer, push to R2
      const fileBuffer = fs.readFileSync(finalPath);
      const result = await uploadToR2(fileBuffer, "videos", originalName, "video/mp4");
      try { fs.unlinkSync(finalPath); } catch {}
      res.json({ success: true, url: result.url, videoUrl: result.url, publicId: result.key });
    } catch (err: any) {
      res.status(500).json({ message: `Finalize failed: ${err.message}` });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ══════════════════════════════════════════════════════════════════════════
// ── LOGIN ──────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const found = await db.select().from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!found.length) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = found[0];
    const bcrypt = await import("bcryptjs");
    if (!user.password) {
  return res.status(401).json({
    message: "Invalid email or password",
  });
}

const valid = await bcrypt.compare(
  password,
  user.password
);

    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    (req.session as any).userId = user.id;

    await db.insert(loginSessions).values({
      userId: user.id,
      deviceInfo: req.headers["user-agent"] || "Unknown device",
      ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || "Unknown",
    });


    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  } catch (err: any) {
    console.error("[login]", err);
    res.status(500).json({ message: err.message || "Login failed" });
  }
});

// ── REGISTER ───────────────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body as {
      firstName?: string; lastName?: string; email?: string; password?: string;
    };
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await db.select({ id: users.id }).from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    if (existing.length) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(password, 10);

    const usernameBase = email.split("@")[0].toLowerCase();
    const username = `${usernameBase}${Math.floor(Math.random() * 10000)}`;

    const [newUser] = await db.insert(users).values({
      email: email.toLowerCase().trim(),
      password: hashed,
      firstName: firstName || "",
      lastName: lastName || "",
      username,
      profileImageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    }).returning();

    (req.session as any).userId = newUser.id;

    const { password: _pw, ...safeUser } = newUser;
    res.json(safeUser);
  } catch (err: any) {
    console.error("[register]", err);
    res.status(500).json({ message: err.message || "Registration failed" });
  }
});
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

      const found = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);
      if (!found.length) return res.status(404).json({ message: "No account found" });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);

      await db.execute(sql`
        INSERT INTO otp_tokens (email, otp, expires_at)
        VALUES (${email.toLowerCase().trim()}, ${otp}, ${expiry})
        ON CONFLICT (email) DO UPDATE SET otp = ${otp}, expires_at = ${expiry}
      `);

      // Resend HTTP API se email bhejo (Render SMTP block karta hai isliye)
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const { error: resendError } = await resend.emails.send({
        from: "IQpartner <noreply@iqpartner.xyz>",
        to: email,
        subject: "Your IQpartner Password Reset Code",
        html: `
          <div style="background:#0a0a0a;padding:40px;font-family:Arial;max-width:600px;margin:0 auto;border-radius:16px;border:1px solid #a855f7;">
            <h1 style="color:#a855f7;font-size:28px;font-weight:900;margin:0 0 8px;">IQpartner</h1>
            <p style="color:#9b9b9b;font-size:14px;">Connect. Learn. Grow.</p>
            <hr style="border:1px solid #222;margin:20px 0;">
            <p style="color:#ffffff;font-size:16px;">Your Password Reset Code:</p>
            <div style="background:linear-gradient(90deg,#a855f7,#ec4899);border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
              <h1 style="color:white;font-size:42px;font-weight:900;letter-spacing:12px;margin:0;">${otp}</h1>
            </div>
            <p style="color:#a855f7;font-size:13px;">⏱ Valid for 10 minutes only</p>
            <p style="color:#9b9b9b;font-size:12px;">If you didn't request this, ignore this email.</p>
            <p style="color:#a855f7;font-weight:bold;margin-top:20px;">— IQpartner Team</p>
          </div>
        `,
      });

      if (resendError) {
        console.error("[forgot-password] Resend error:", resendError);
        throw new Error(resendError.message || "Failed to send email");
      }

      res.json({ message: "OTP sent" });
    } catch (err: any) {
      console.error("[forgot-password]", err.message);
      res.status(500).json({ message: err.message || "Failed to send OTP" });
    }
  });

  app.delete("/api/profile/delete", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      await db.execute(sql`DELETE FROM likes WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM comments WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM saved_posts WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM notifications WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM follows WHERE follower_id = ${userId} OR following_id = ${userId}`);
      await db.execute(sql`DELETE FROM posts WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM direct_messages WHERE sender_id = ${userId}`);
      await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
      (req.session as any).destroy?.();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Delete failed" });
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
  // JOB ROUTES — PostgreSQL metadata + Cloudflare R2 media
  // ══════════════════════════════════════════════════════════════════════════

  // Keep job images small. Do NOT use the 500MB general memory upload for jobs.
  const jobImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed"));
    },
  });

  // Upload an optional job image to the existing R2 bucket.
  app.post("/api/jobs/upload", isAuthenticated, (req: any, res: any) => {
    jobImageUpload.single("image")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No job image received" });

      try {
        const result = await uploadToR2(
          req.file.buffer,
          "jobs/images",
          req.file.originalname,
          req.file.mimetype
        );
        return res.status(201).json({
          success: true,
          url: result.url,
          imageUrl: result.url,
          key: result.key,
        });
      } catch (error: any) {
        console.error("[jobs upload]", error);
        return res.status(500).json({ message: error.message || "Job image upload failed" });
      }
    });
  });

  // Public active job feed. Supports ?limit=20&page=1.
  app.get("/api/jobs", async (req, res) => {
    try {
      const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
      const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || "20"), 10) || 20));
      const offset = (page - 1) * limit;

      const result = await db.execute(sql`
        SELECT
          j.*,
          u.first_name, u.last_name, u.username, u.profile_image_url
        FROM jobs j
        LEFT JOIN users u ON CAST(u.id AS TEXT) = j.user_id
        WHERE j.active = TRUE
        ORDER BY j.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return res.json((((result as any).rows ?? result) as any[]).map(mapJobRow));
    } catch (error: any) {
      console.error("[jobs list]", error);
      return res.status(500).json({ message: error.message || "Failed to load jobs" });
    }
  });

  // Get one active job.
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid job id" });
      }

      const result = await db.execute(sql`
        SELECT
          j.*,
          u.first_name, u.last_name, u.username, u.profile_image_url
        FROM jobs j
        LEFT JOIN users u ON CAST(u.id AS TEXT) = j.user_id
        WHERE j.id = ${id} AND j.active = TRUE
        LIMIT 1
      `);
      const rows = (result as any).rows ?? result;
      if (!rows?.length) return res.status(404).json({ message: "Job not found" });
      return res.json(mapJobRow(rows[0]));
    } catch (error: any) {
      console.error("[jobs get]", error);
      return res.status(500).json({ message: error.message || "Failed to load job" });
    }
  });

  // Create a job. The logged-in user id always comes from the server session.
  app.post("/api/jobs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = String(req.session.userId);
      const body = req.body ?? {};

      const title = String(body.title ?? "").trim();
      const company = String(body.company ?? "").trim();
      const email = String(body.email ?? "").trim();
      const pin = String(body.pin ?? "").trim();
      const description = String(body.description ?? body.desc ?? "").trim();
      const location = String(body.location ?? "Remote").trim() || "Remote";
      const salary = String(body.salary ?? "Negotiable").trim() || "Negotiable";
      const jobType = String(body.jobType ?? body.job_type ?? body.type ?? "Full-time").trim();
      const emoji = String(body.emoji ?? "💼").trim() || "💼";
      const tags = Array.isArray(body.tags)
        ? body.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
        : String(body.tags ?? "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
      const ejsPubkey = String(body.ejsPubkey ?? body.ejs_pubkey ?? "").trim();
      const ejsService = String(body.ejsService ?? body.ejs_service ?? "").trim();
      const ejsTemplate = String(body.ejsTemplate ?? body.ejs_template ?? "").trim();
      const imageUrl = String(body.imageUrl ?? body.image_url ?? "").trim() || null;
      const applyUrl = String(body.applyUrl ?? body.apply_url ?? "").trim() || null;
      const postedAt = String(body.postedAt ?? body.posted_at ?? new Date().toISOString()).trim();

      if (!title) return res.status(400).json({ message: "Job title is required" });
      if (!company) return res.status(400).json({ message: "Company name is required" });
      if (title.length > 180) return res.status(400).json({ message: "Job title is too long" });
      if (company.length > 180) return res.status(400).json({ message: "Company name is too long" });
      if (location.length > 180) return res.status(400).json({ message: "Location is too long" });
      if (salary.length > 120) return res.status(400).json({ message: "Salary text is too long" });
      if (jobType.length > 80) return res.status(400).json({ message: "Job type is too long" });
      if (pin && !/^\d{4}$/.test(pin)) {
        return res.status(400).json({ message: "PIN must be exactly 4 digits" });
      }

      const result = await db.execute(sql`
        INSERT INTO jobs
          (
            user_id, title, company, email, pin, description, location, salary,
            type, job_type, emoji, tags, ejs_pubkey, ejs_service, ejs_template,
            image_url, apply_url, posted_at, active
          )
        VALUES
          (
            ${userId}, ${title}, ${company}, ${email}, ${pin}, ${description},
            ${location}, ${salary}, ${jobType}, ${jobType}, ${emoji}, ${tags},
            ${ejsPubkey}, ${ejsService}, ${ejsTemplate}, ${imageUrl}, ${applyUrl},
            ${postedAt}, TRUE
          )
        RETURNING *
      `);

      const rows = (result as any).rows ?? result;
      return res.status(201).json(mapJobRow(rows[0]));
    } catch (error: any) {
      console.error("[jobs create]", error);
      return res.status(500).json({ message: error.message || "Failed to post job" });
    }
  });

  // Edit only your own job.
  app.patch("/api/jobs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const userId = String(req.session.userId);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid job id" });
      }

      const existingResult = await db.execute(sql`
        SELECT * FROM jobs WHERE id = ${id} AND user_id = ${userId} LIMIT 1
      `);
      const existingRows = (existingResult as any).rows ?? existingResult;
      if (!existingRows?.length) return res.status(404).json({ message: "Job not found" });
      const existing = existingRows[0];
      const body = req.body ?? {};

      const title = String(body.title ?? existing.title).trim();
      const company = String(body.company ?? existing.company ?? "").trim();
      const description = String(body.description ?? existing.description ?? "").trim();
      const location = String(body.location ?? existing.location ?? "").trim();
      const salary = String(body.salary ?? existing.salary ?? "").trim();
      const jobType = String(
        body.jobType ?? body.job_type ?? body.type ?? existing.job_type ?? existing.type ?? "Full-time"
      ).trim();
      const imageUrl = body.imageUrl !== undefined || body.image_url !== undefined
        ? (String(body.imageUrl ?? body.image_url ?? "").trim() || null)
        : existing.image_url;
      const applyUrl = body.applyUrl !== undefined || body.apply_url !== undefined
        ? (String(body.applyUrl ?? body.apply_url ?? "").trim() || null)
        : existing.apply_url;
      const active = typeof body.active === "boolean" ? body.active : Boolean(existing.active);

      if (!title) return res.status(400).json({ message: "Job title is required" });

      const result = await db.execute(sql`
        UPDATE jobs
        SET title = ${title}, company = ${company}, description = ${description},
            location = ${location}, salary = ${salary},
            type = ${jobType}, job_type = ${jobType},
            image_url = ${imageUrl}, apply_url = ${applyUrl}, active = ${active},
            updated_at = NOW()
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `);
      const rows = (result as any).rows ?? result;
      return res.json(mapJobRow(rows[0]));
    } catch (error: any) {
      console.error("[jobs update]", error);
      return res.status(500).json({ message: error.message || "Failed to update job" });
    }
  });

  // Soft-delete your job so old links do not break abruptly.
  app.delete("/api/jobs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const userId = String(req.session.userId);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid job id" });
      }

      const result = await db.execute(sql`
        UPDATE jobs SET active = FALSE, updated_at = NOW()
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id
      `);
      const rows = (result as any).rows ?? result;
      if (!rows?.length) return res.status(404).json({ message: "Job not found" });
      return res.json({ success: true, id });
    } catch (error: any) {
      console.error("[jobs delete]", error);
      return res.status(500).json({ message: error.message || "Failed to delete job" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.get(api.posts.list.path, isAuthenticated, async (req, res) => {
  try {
    const sessionUserId = (req.session as any).userId;
    const filterUserId = req.query.userId as string | undefined;

    // ── Pagination — chahe 1 lakh ho ya 5 lakh, ek baar mein sirf 20 posts ──
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * pageSize;

    // Base query — sirf zaroori columns, LIMIT/OFFSET ke saath
    let baseQuery = sql`
      SELECT p.* FROM posts p
      WHERE p.type != 'deleted'
      ${filterUserId ? sql`AND p.user_id = ${filterUserId}` : sql``}
      ORDER BY p.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const postsRows = await db.execute(baseQuery);
    const rawPosts = (postsRows as any).rows ?? postsRows;

    if (rawPosts.length === 0) {
      return res.json([]);
    }

    // Block filtering — chhoti list pe hi (max 50 posts), fast rehta hai
    const blockedPosts = await db.select({ postId: pendingBlocks.postId }).from(pendingBlocks)
      .where(and(eq(pendingBlocks.blockedUserId, sessionUserId), sql`${pendingBlocks.blockUntil} > CURRENT_TIMESTAMP`));
    const blockedPostIds = new Set(blockedPosts.map(b => b.postId));

    const myBlockRows = await db.execute(sql`
      SELECT blocked_id, blocker_id FROM blocks
      WHERE blocker_id = ${sessionUserId} OR blocked_id = ${sessionUserId}
    `);
    const relatedIds = new Set<string>();
    ((myBlockRows as any).rows ?? myBlockRows).forEach((r: any) => {
      relatedIds.add(r.blocker_id === sessionUserId ? r.blocked_id : r.blocker_id);
    });

    const finalPosts = rawPosts.filter((p: any) =>
      !blockedPostIds.has(p.id) && !relatedIds.has(String(p.user_id))
    );

    if (finalPosts.length === 0) {
      return res.json([]);
    }

    // ── Batch fix: 50 posts ke liye bhi sirf ~5 queries, N+1 nahi ──
    const postIds = finalPosts.map((p: any) => p.id);
    const userIds = [...new Set(finalPosts.map((p: any) => String(p.user_id)))];
   const [usersRows, likesRows, commentsRows, likedRows, savedRows] = await Promise.all([
  db.execute(sql`SELECT id, first_name, last_name, username, profile_image_url FROM users WHERE id IN ${userIds}`),
  db.execute(sql`SELECT post_id, COUNT(*) as cnt FROM likes WHERE post_id IN ${postIds} GROUP BY post_id`),
  db.execute(sql`SELECT post_id, COUNT(*) as cnt FROM comments WHERE post_id IN ${postIds} GROUP BY post_id`),
  db.execute(sql`SELECT post_id FROM likes WHERE post_id IN ${postIds} AND user_id = ${sessionUserId}`),
  db.execute(sql`SELECT post_id FROM saved_posts WHERE post_id IN ${postIds} AND user_id = ${sessionUserId}`),
]);
   

    const userMap = new Map(((usersRows as any).rows ?? usersRows).map((u: any) => [String(u.id), u]));
    const likesMap = new Map(((likesRows as any).rows ?? likesRows).map((r: any) => [r.post_id, parseInt(r.cnt)]));
    const commentsMap = new Map(((commentsRows as any).rows ?? commentsRows).map((r: any) => [r.post_id, parseInt(r.cnt)]));
    const likedSet = new Set(((likedRows as any).rows ?? likedRows).map((r: any) => r.post_id));
    const savedSet = new Set(((savedRows as any).rows ?? savedRows).map((r: any) => r.post_id));

    const enrichedPosts = finalPosts.map((post: any) => ({
      ...mapPostRow(post),
      user: userMap.get(String(post.user_id)) || null,
      likesCount: likesMap.get(post.id) ?? 0,
      commentsCount: commentsMap.get(post.id) ?? 0,
      hasLiked: likedSet.has(post.id),
      hasSaved: savedSet.has(post.id),
    }));

    res.json(enrichedPosts);
  } catch (err: any) {
    console.error("[posts list]", err);
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

app.get("/api/user/saved", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const rows = await db
      .select({ post: posts })
      .from(savedPosts)
      .innerJoin(posts, eq(savedPosts.postId, posts.id))
      .where(eq(savedPosts.userId, userId))
      .orderBy(desc(savedPosts.createdAt));

    res.json(rows.map(r => r.post));
  } catch (err: any) {
    console.error("Fetch saved posts error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/posts/:id", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err: any) {
    console.error("Fetch post error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/users/following", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const rows = await db
      .select({ user: users })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId));
    res.json(rows.map(r => r.user));
  } catch (err: any) {
    console.error("Fetch following error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/posts/:id/send", isAuthenticated, async (req, res) => {
  try {
    const senderId = (req.session as any).userId;
    const postId = Number(req.params.id);
    const { userIds } = req.body as { userIds: string[] };

    if (!userIds || userIds.length === 0) {
      return res.status(400).json({ message: "No recipients selected" });
    }

    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    if (!post) return res.status(404).json({ message: "Post not found" });

    for (const otherUserId of userIds) {
      let [chat] = await db
        .select()
        .from(directChats)
        .where(
          or(
            and(eq(directChats.user1Id, senderId), eq(directChats.user2Id, otherUserId)),
            and(eq(directChats.user1Id, otherUserId), eq(directChats.user2Id, senderId))
          )
        );

      if (!chat) {
        [chat] = await db
          .insert(directChats)
          .values({ user1Id: senderId, user2Id: otherUserId })
          .returning();
      }

      await db.insert(directMessages).values({
        chatId: chat.id,
        senderId,
        content: post.caption || "Shared a post",
        type: "post_share",
        mediaUrl: post.videoUrl ? post.videoUrl : post.imageUrl,
      });

      const receiverWs = wsClients.get(String(otherUserId));
      if (receiverWs && receiverWs.readyState === 1) {
        receiverWs.send(JSON.stringify({ type: "new_message", chatId: chat.id }));
      }
    }

    res.json({ success: true, sentTo: userIds.length });
  } catch (err: any) {
    console.error("Send post error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
  // RESTRICTED ACCOUNTS
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/restricted", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rows = await db.select({ user: users })
        .from(restrictedAccounts)
        .innerJoin(users, eq(restrictedAccounts.restrictedUserId, users.id))
        .where(eq(restrictedAccounts.userId, userId));
      res.json(rows.map(r => r.user));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/restricted/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const targetId = req.params.userId;
      if (userId === targetId) return res.status(400).json({ message: "Cannot restrict yourself" });
      await db.insert(restrictedAccounts).values({ userId, restrictedUserId: targetId }).onConflictDoNothing();
      res.json({ restricted: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/restricted/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const targetId = req.params.userId;
      await db.delete(restrictedAccounts).where(and(eq(restrictedAccounts.userId, userId), eq(restrictedAccounts.restrictedUserId, targetId)));
      res.json({ restricted: false });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // HIDDEN WORDS
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/hidden-words", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rows = await db.select().from(hiddenWords).where(eq(hiddenWords.userId, userId));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/hidden-words", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { word } = req.body;
      if (!word?.trim()) return res.status(400).json({ message: "Word required" });
      const [row] = await db.insert(hiddenWords).values({ userId, word: word.trim().toLowerCase() }).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/hidden-words/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await db.delete(hiddenWords).where(and(eq(hiddenWords.id, Number(req.params.id)), eq(hiddenWords.userId, userId)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CLOSE FRIENDS (InnerCircle)
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/close-friends", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rows = await db.select({ user: users })
        .from(closeFriends)
        .innerJoin(users, eq(closeFriends.friendId, users.id))
        .where(eq(closeFriends.userId, userId));
      res.json(rows.map(r => r.user));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/close-friends/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const friendId = req.params.userId;
      if (userId === friendId) return res.status(400).json({ message: "Cannot add yourself" });
      await db.insert(closeFriends).values({ userId, friendId }).onConflictDoNothing();
      res.json({ added: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/close-friends/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const friendId = req.params.userId;
      await db.delete(closeFriends).where(and(eq(closeFriends.userId, userId), eq(closeFriends.friendId, friendId)));
      res.json({ added: false });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST DRAFTS (ProTools Hub)
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/drafts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rows = await db.select().from(postDrafts).where(eq(postDrafts.userId, userId)).orderBy(desc(postDrafts.updatedAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/drafts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { caption, imageUrl, videoUrl, type } = req.body;
      const [row] = await db.insert(postDrafts).values({ userId, caption, imageUrl, videoUrl, type }).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/drafts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { caption, imageUrl, videoUrl, type } = req.body;
      const [row] = await db.update(postDrafts)
        .set({ caption, imageUrl, videoUrl, type, updatedAt: new Date() })
        .where(and(eq(postDrafts.id, Number(req.params.id)), eq(postDrafts.userId, userId)))
        .returning();
      if (!row) return res.status(404).json({ message: "Draft not found" });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/drafts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await db.delete(postDrafts).where(and(eq(postDrafts.id, Number(req.params.id)), eq(postDrafts.userId, userId)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SCHEDULED POSTS (ProTools Hub)
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/scheduled-posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rows = await db.select().from(scheduledPosts).where(eq(scheduledPosts.userId, userId)).orderBy(scheduledPosts.scheduledFor);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/scheduled-posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { caption, imageUrl, videoUrl, type, scheduledFor } = req.body;
      if (!scheduledFor) return res.status(400).json({ message: "scheduledFor required" });
      const [row] = await db.insert(scheduledPosts).values({
        userId, caption, imageUrl, videoUrl, type, scheduledFor: new Date(scheduledFor),
      }).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/scheduled-posts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await db.update(scheduledPosts)
        .set({ status: "cancelled" })
        .where(and(eq(scheduledPosts.id, Number(req.params.id)), eq(scheduledPosts.userId, userId)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Background job — har 5 min me due scheduled posts publish karo
  setInterval(async () => {
    try {
      const due = await db.select().from(scheduledPosts)
        .where(and(eq(scheduledPosts.status, "pending"), sql`${scheduledPosts.scheduledFor} <= NOW()`));
      for (const sp of due) {
        await storage.createPost({
          userId: sp.userId, caption: sp.caption, imageUrl: sp.imageUrl || "", videoUrl: sp.videoUrl, type: sp.type || "post",
        });
        await db.update(scheduledPosts).set({ status: "published" }).where(eq(scheduledPosts.id, sp.id));
      }
    } catch (err) {
      console.error("[scheduled posts publisher]", err);
    }
  }, 5 * 60 * 1000);

  // ══════════════════════════════════════════════════════════════════════════
  // PROFILE VIEWS (InsightX)
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/users/:id/view-profile", isAuthenticated, async (req: any, res) => {
    try {
      const viewerId = req.session.userId;
      const viewedUserId = req.params.id;
      if (viewerId === viewedUserId) return res.json({ success: true });
      await db.insert(profileViews).values({ viewerId, viewedUserId });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/insights/profile-views", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const totalRows = await db.execute(sql`SELECT COUNT(*) as cnt FROM profile_views WHERE viewed_user_id = ${userId}`);
      const total = parseInt(((totalRows as any).rows ?? totalRows)[0]?.cnt ?? "0");
      const last7Rows = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM profile_views
        WHERE viewed_user_id = ${userId} AND created_at > NOW() - INTERVAL '7 days'
      `);
      const last7Days = parseInt(((last7Rows as any).rows ?? last7Rows)[0]?.cnt ?? "0");
      res.json({ total, last7Days });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN SESSIONS (Security → Devices)
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rows = await db.select().from(loginSessions).where(eq(loginSessions.userId, userId)).orderBy(desc(loginSessions.lastActive));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await db.delete(loginSessions).where(and(eq(loginSessions.id, Number(req.params.id)), eq(loginSessions.userId, userId)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // AD PREFERENCES
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/ad-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rows = await db.select().from(adPreferences).where(eq(adPreferences.userId, userId));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ad-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { type, value } = req.body;
      if (!type || !value) return res.status(400).json({ message: "type and value required" });
      const [row] = await db.insert(adPreferences).values({ userId, type, value }).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/ad-preferences/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await db.delete(adPreferences).where(and(eq(adPreferences.id, Number(req.params.id)), eq(adPreferences.userId, userId)));
      res.json({ success: true });
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
      const row = await db.execute(sql`SELECT viewer_count, user_id FROM posts WHERE id = ${postId}`);
      const resultRow = ((row as any).rows?.[0] ?? (row as any)[0]) || {};
      const viewerCount = parseInt(resultRow.viewer_count ?? "0");
      const postOwnerId = resultRow.user_id;
      const previousCount = Math.max(viewerCount - 1, 0);
      const previousTier = Math.floor(previousCount / 300000);
      const currentTier = Math.floor(viewerCount / 300000);
      if (postOwnerId && currentTier > previousTier) {
        await db.execute(sql`UPDATE users SET coins = coins + 1 WHERE id = ${postOwnerId}`);
      }
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
      const userId = req.query.userId as string | undefined;
      const type = req.query.type as string | undefined;
      const books = await storage.getBooks(userId, type);
      res.json(books);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/books/mine", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const books = await storage.getBooks(userId);
      res.json(books);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/books", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const book = await storage.createBook({
        ...req.body,
        userId,
        content: req.body.content ?? "",
      });
      res.status(201).json(book);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/books/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const bookId = Number(req.params.id);
      const deleted = await storage.deleteBook(bookId, userId);
      if (!deleted) return res.status(404).json({ message: "Book not found or you do not have permission." });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/users/:id/block", isAuthenticated, async (req: any, res) => {
    try {
      const blockerId = req.session.userId;
      const blockedId = req.params.id;
      if (blockerId === blockedId) return res.status(400).json({ message: "Cannot block yourself" });

      await db.insert(blocks).values({ blockerId, blockedId, reason: req.body?.reason })
        .onConflictDoNothing();

      // dono taraf follow relation hata do
      await db.execute(sql`
        DELETE FROM follows
        WHERE (follower_id = ${blockerId} AND following_id = ${blockedId})
           OR (follower_id = ${blockedId} AND following_id = ${blockerId})
      `);

      res.json({ blocked: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/users/:id/block", isAuthenticated, async (req: any, res) => {
    try {
      const blockerId = req.session.userId;
      const blockedId = req.params.id;
      await db.execute(sql`DELETE FROM blocks WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}`);
      res.json({ blocked: false });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/block-status", isAuthenticated, async (req: any, res) => {
    try {
      const me = req.session.userId;
      const otherId = req.params.id;
      const iBlocked = await db.select().from(blocks)
        .where(and(eq(blocks.blockerId, me), eq(blocks.blockedId, otherId))).limit(1);
      const blockedMe = await db.select().from(blocks)
        .where(and(eq(blocks.blockerId, otherId), eq(blocks.blockedId, me))).limit(1);
      res.json({ blocked: iBlocked.length > 0, blockedByOther: blockedMe.length > 0 });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/blocked", isAuthenticated, async (req: any, res) => {
    try {
      const me = req.session.userId;
      const rows = await db.execute(sql`
        SELECT u.id, u.first_name, u.last_name, u.username, u.profile_image_url
        FROM blocks b JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = ${me}
        ORDER BY b.created_at DESC
      `);
      const list = (rows as any).rows ?? rows;
      res.json(list.map((u: any) => ({
        id: u.id, firstName: u.first_name, lastName: u.last_name,
        username: u.username, profileImageUrl: u.profile_image_url,
      })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/users/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const reporterId = req.session.userId;
      const reportedUserId = req.params.id;
      const { reason, details } = req.body;
      if (!reason) return res.status(400).json({ message: "Reason required" });
      if (reporterId === reportedUserId) return res.status(400).json({ message: "Cannot report yourself" });
      await db.insert(reports).values({ reporterId, reportedUserId, reason, description: details });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const VOICE_ROOM_REQUIRED_VIDEOS = 4;
const VOICE_ROOM_REQUIRED_POSTS = 3;

app.get("/api/users/me/stats", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.session.userId;

    const videoRows = await db.execute(sql`SELECT COUNT(*) as cnt FROM posts WHERE user_id = ${userId} AND type = 'video'`);
    const postRows = await db.execute(sql`SELECT COUNT(*) as cnt FROM posts WHERE user_id = ${userId} AND type = 'post'`);
    const videoCount = parseInt(((videoRows as any).rows ?? videoRows)[0]?.cnt ?? "0");
    const postCount = parseInt(((postRows as any).rows ?? postRows)[0]?.cnt ?? "0");

    const userRows = await db.execute(sql`SELECT voice_room_unlocked FROM users WHERE id = ${userId}`);
    let voiceRoomUnlocked = !!((userRows as any).rows ?? userRows)[0]?.voice_room_unlocked;

    // Agar abhi tak unlock nahi hua, har stats-check pe recheck karo (frontend har 3 sec poll karta hai)
    if (!voiceRoomUnlocked && videoCount >= VOICE_ROOM_REQUIRED_VIDEOS && postCount >= VOICE_ROOM_REQUIRED_POSTS) {
      await db.execute(sql`UPDATE users SET voice_room_unlocked = TRUE WHERE id = ${userId}`);
      voiceRoomUnlocked = true;
    }

    res.json({ videoCount, postCount, voiceRoomUnlocked });
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

  app.get("/api/preferences", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId as string | undefined;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const [row] = await db.select({ languagePreference: users.languagePreference }).from(users).where(eq(users.id, userId)).limit(1);
      res.json({ languagePreference: row?.languagePreference || "en" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/preferences", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId as string | undefined;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { languagePreference } = req.body || {};
      if (languagePreference !== "en" && languagePreference !== "hi") {
        return res.status(400).json({ message: "Unsupported language" });
      }
      await db.update(users).set({ languagePreference, updatedAt: new Date() }).where(eq(users.id, userId));
      res.json({ success: true, languagePreference });
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

  app.delete("/api/account", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { password } = req.body;
      const existing = await authStorage.getUser(userId);
      if (!existing) return res.status(404).json({ message: "User not found" });

      const bcrypt = await import("bcryptjs");
      const valid = await bcrypt.compare(password || "", (existing as any).password || "");
      if (!valid) return res.status(401).json({ message: "Incorrect password" });

      // Cloudinary cleanup ke liye media urls nikaal lo (delete se pehle)
      const userPosts = await db.select({ imageUrl: posts.imageUrl, videoUrl: posts.videoUrl })
        .from(posts).where(eq(posts.userId, userId));

      await db.execute(sql`DELETE FROM likes WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM comments WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM saved_posts WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM story_likes WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM story_comments WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM stories WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM notifications WHERE user_id = ${userId} OR from_user_id = ${userId}`);
      await db.execute(sql`DELETE FROM follows WHERE follower_id = ${userId} OR following_id = ${userId}`);
      await db.execute(sql`DELETE FROM blocks WHERE blocker_id = ${userId} OR blocked_id = ${userId}`);
      await db.execute(sql`DELETE FROM pending_blocks WHERE reported_user_id = ${userId} OR blocked_user_id = ${userId}`);
      await db.execute(sql`DELETE FROM reports WHERE reporter_id = ${userId} OR reported_user_id = ${userId}`);
      await db.execute(sql`DELETE FROM history WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM group_members WHERE user_id = ${userId}`);

      const chatRows = await db.execute(sql`SELECT id FROM direct_chats WHERE user1_id = ${userId} OR user2_id = ${userId}`);
      for (const r of ((chatRows as any).rows ?? chatRows)) {
        await db.execute(sql`DELETE FROM direct_messages WHERE chat_id = ${r.id}`);
      }
      await db.execute(sql`DELETE FROM direct_chats WHERE user1_id = ${userId} OR user2_id = ${userId}`);

      await db.execute(sql`DELETE FROM posts WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM books WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);

      userPosts.forEach((p: any) => {
        if (p.imageUrl) deleteFromCloudinary(p.imageUrl).catch(() => {});
        if (p.videoUrl) deleteFromCloudinary(p.videoUrl).catch(() => {});
      });

      req.session.destroy(() => {});
      res.json({ success: true });
    } catch (err: any) {
      console.error("[delete account] Error:", err);
      res.status(500).json({ message: err.message || "Failed to delete account" });
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
      if (await isBlockedEitherWay(followerId, followingId)) {
        return res.status(403).json({ message: "You can't follow this account" });
      }
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
  // STORY ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/stories", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT s.*, u.first_name, u.last_name, u.username, u.profile_image_url
        FROM stories s
        JOIN users u ON u.id = s.user_id
        WHERE s.expires_at > NOW()
        ORDER BY s.created_at DESC
      `);
      const rows = (result as any).rows ?? result;
      res.json(rows.map(mapStoryRow));   // ← "res.json(rows)" ki jagah ye
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/stories", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { mediaUrl, type, caption } = req.body;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
      const result = await db.execute(sql`
        INSERT INTO stories (user_id, media_url, type, caption, expires_at)
        VALUES (${userId}, ${mediaUrl}, ${type || 'image'}, ${caption || null}, ${expiresAt})
        RETURNING *
      `);
      const rows = (result as any).rows ?? result;
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/stories/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const storyId = Number(req.params.id);
      await db.execute(sql`
        DELETE FROM stories 
        WHERE id = ${storyId} AND user_id = ${userId}
      `);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/stories/:id/like", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const storyId = Number(req.params.id);
      const existing = await db.execute(sql`
        SELECT id FROM story_likes 
        WHERE story_id = ${storyId} AND user_id = ${userId}
        LIMIT 1
      `);
      const rows = (existing as any).rows ?? existing;
      if (rows.length > 0) {
        await db.execute(sql`DELETE FROM story_likes WHERE story_id = ${storyId} AND user_id = ${userId}`);
        return res.json({ liked: false });
      } else {
        await db.execute(sql`INSERT INTO story_likes (story_id, user_id) VALUES (${storyId}, ${userId})`);
        return res.json({ liked: true });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/stories/:id/likes", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT u.id, u.first_name, u.last_name, u.username, u.profile_image_url
        FROM story_likes sl
        JOIN users u ON u.id = sl.user_id
        WHERE sl.story_id = ${Number(req.params.id)}
      `);
      const rows = (result as any).rows ?? result;
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/stories/:id/comment", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const storyId = Number(req.params.id);
      const { content } = req.body;
      await db.execute(sql`
        INSERT INTO story_comments (story_id, user_id, content)
        VALUES (${storyId}, ${userId}, ${content})
      `);
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/stories/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT sc.*, u.first_name, u.last_name, u.username, u.profile_image_url
        FROM story_comments sc
        JOIN users u ON u.id = sc.user_id
        WHERE sc.story_id = ${Number(req.params.id)}
        ORDER BY sc.created_at ASC
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
  // ONLINE STATUS
  // ══════════════════════════════════════════════════════════════════════════
  app.post("/api/status/online", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await storage.setOnlineStatus(userId, true);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/status/offline", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await storage.setOnlineStatus(userId, false);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  // ══════════════════════════════════════════════════════════════════════════
  // DIRECT CHAT ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/direct-chats", isAuthenticated, async (req, res) => {
    try {
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
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/direct-chats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { otherUserId } = req.body;
      if (!otherUserId) return res.status(400).json({ message: "otherUserId required" });
      if (await isBlockedEitherWay(userId, otherUserId)) {
        return res.status(403).json({ message: "You can't message this user" });
      }
      const chat = await storage.getOrCreateDirectChat(userId, otherUserId);
      res.json(chat);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/direct-chats/:id/theme", isAuthenticated, async (req, res) => {
    await storage.updateChatTheme(Number(req.params.id), req.body.theme);
    res.json({ ok: true });
  });

  app.get("/api/direct-chats/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const chatId = Number(req.params.id);

      const chatRows = await db.execute(sql`SELECT user1_id, user2_id FROM direct_chats WHERE id = ${chatId}`);
      const chatRow = ((chatRows as any).rows ?? chatRows as any)[0];
      if (chatRow) {
        const other = chatRow.user1_id === userId ? chatRow.user2_id : chatRow.user1_id;
        if (await isBlockedEitherWay(userId, other)) {
          return res.status(403).json({ message: "You can't message this user" });
        }
      }

      const msgs = await storage.getDirectMessages(chatId);
      res.json(msgs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/direct-chats/:id/messages", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const chatId = Number(req.params.id);
    const { content, type, mediaUrl, metadata, replyToId, expiresInSeconds } = req.body;
    const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : undefined;

    // Block check pehle — reuse yehi chatRow niche notification ke liye bhi
    const chatRows = await db.execute(sql`SELECT user1_id, user2_id FROM direct_chats WHERE id = ${chatId}`);
    const chatRow = ((chatRows as any).rows ?? chatRows as any)[0];
    if (chatRow) {
      const other = chatRow.user1_id === userId ? chatRow.user2_id : chatRow.user1_id;
      if (await isBlockedEitherWay(userId, other)) {
        return res.status(403).json({ message: "You can't message this user" });
      }
    }

    const msg = await storage.sendDirectMessage({
      chatId, senderId: userId, content,
      type: type || "text", mediaUrl, metadata, replyToId,
      ...(expiresAt ? { expiresAt } : {}),
    });

    res.status(201).json(msg);

    try {
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
      console.error("[ direct-chat message] background error:", e);
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
  // Single message delete — res.json() sirf ek baar, Cloudinary se bhi media delete hoga
  // ══════════════════════════════════════════════════════════════════════════
    // ══════════════════════════════════════════════════════════════════════════
  // Hide message for current user only ("Delete for me")
  // ══════════════════════════════════════════════════════════════════════════
  app.patch("/api/messages/:id/hide", isAuthenticated, async (req: any, res) => {
    const userId = req.session.userId;
    const messageId = Number(req.params.id);
    try {
      await storage.hideMessageForUser(messageId, userId);
      res.json({ success: true, id: messageId });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to hide message" });
    }
  });
  app.delete("/api/messages/:id", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const messageId = Number(req.params.id);

    try {
      const msgRows = await db.execute(
        sql`SELECT * FROM direct_messages WHERE id = ${messageId} LIMIT 1`
      );
      const msgRow = ((msgRows as any).rows ?? msgRows as any)[0];

      if (!msgRow) {
        return res.status(404).json({ message: "Message not found" });
      }

      if (msgRow.media_url && msgRow.type !== "text" && msgRow.type !== "voice") {
        deleteFromCloudinary(msgRow.media_url).catch(err =>
          console.error("[delete message] Cloudinary cleanup error:", err)
        );
      }

      await storage.deleteMessage(messageId);

      res.json({ success: true, id: messageId });

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
  // Clear all chat — Cloudinary se saari media bhi delete hogi
  // ══════════════════════════════════════════════════════════════════════════
  app.delete("/api/direct-chats/:id/messages", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const chatId = Number(req.params.id);

    try {
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

      const allMsgs = await db.execute(
        sql`SELECT media_url, type FROM direct_messages WHERE chat_id = ${chatId} AND media_url IS NOT NULL`
      );
      const mediaRows = ((allMsgs as any).rows ?? allMsgs as any);

      mediaRows
        .filter((m: any) => m.media_url && m.type !== "text" && m.type !== "voice")
        .forEach((m: any) => {
          deleteFromCloudinary(m.media_url).catch(err =>
            console.error("[clear chat] Cloudinary cleanup error:", err)
          );
        });

      await db.execute(sql`DELETE FROM direct_messages WHERE chat_id = ${chatId}`);

      res.json({ success: true, chatId });

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
  // AGORA VOICE TOKEN
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/agora/token", isAuthenticated, async (req: any, res) => {
    try {
      const { channelName } = req.body;
      if (!channelName) return res.status(400).json({ message: "channelName required" });
      const userId = req.session.userId;
      const result = generateAgoraToken(channelName, String(userId));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Token generation failed" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RECOMMENDED VIDEOS FEED (goal-based, cached to save API quota)
  // ══════════════════════════════════════════════════════════════════════════
  const youtubeCache = new Map<string, { data: any[]; expiresAt: number }>();
  const YOUTUBE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

  const GOAL_TO_QUERY: Record<string, string> = {
    ias: "UPSC IAS preparation strategy India",
    doctor: "medical NEET doctor study India",
    engineer: "coding programming tutorial",
    teacher: "teaching skills education India",
    business: "business growth strategy India",
    vfx: "VFX animation tutorial",
    fitness: "fitness workout training",
    reading: "study tips learning skills",
    law: "law LLB exam preparation India",
    ca: "CA finance accounting India",
    design: "UI UX design tutorial",
    music: "music production singing",
    sports: "sports athlete training",
    neet: "NEET biology preparation India",
    defense: "army defense exam preparation India",
    content: "content creation tips",
    aviation: "pilot aviation training",
    police: "SSC police exam preparation India",
    pharmacy: "pharmacy pharmacology study",
    acting: "acting drama skills",
    chef: "chef cooking culinary skills",
    cyber: "cyber security tutorial",
    space: "ISRO space science India",
    language: "language learning tips",
  };

  app.get("/api/youtube/feed", isAuthenticated, async (req: any, res) => {
    try {
      const goal = ((req.query.query as string) || "").toLowerCase().trim();
      if (!goal) return res.json([]);

      const searchQuery = GOAL_TO_QUERY[goal] || goal;
      const cacheKey = goal;

      const cached = youtubeCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json(cached.data);
      }

      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) return res.status(500).json({ message: "YouTube API key not configured" });

      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&videoEmbeddable=true&maxResults=25&key=${apiKey}`;
      const ytRes = await fetch(url);
      const ytData: any = await ytRes.json();

      if (!ytRes.ok) {
        return res.status(500).json({ message: ytData?.error?.message || "Video fetch failed" });
      }

      const videos = (ytData.items || []).map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      }));

      youtubeCache.set(cacheKey, { data: videos, expiresAt: Date.now() + YOUTUBE_CACHE_TTL });
      res.json(videos);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // ══════════════════════════════════════════════════════════════════════════
  // COINS SYSTEM
  // ══════════════════════════════════════════════════════════════════════════

  async function getOrCreateWallet(userId: string) {
    const existing = await db.execute(sql`SELECT * FROM coin_wallets WHERE user_id = ${userId}`);
    const rows = (existing as any).rows ?? existing;
    if (rows.length > 0) return rows[0];
    await db.execute(sql`INSERT INTO coin_wallets (user_id, balance) VALUES (${userId}, 0) ON CONFLICT DO NOTHING`);
    return { user_id: userId, balance: 0 };
  }

  async function addCoins(userId: string, amount: number, reason: string, referenceId?: string) {
    await getOrCreateWallet(userId);
    await db.execute(sql`
      UPDATE coin_wallets SET balance = balance + ${amount}, updated_at = NOW()
      WHERE user_id = ${userId}
    `);
    await db.execute(sql`
      INSERT INTO coin_transactions (user_id, amount, reason, reference_id)
      VALUES (${userId}, ${amount}, ${reason}, ${referenceId || null})
    `);
  }

  app.get("/api/coins/balance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const wallet = await getOrCreateWallet(userId);
      res.json({ balance: wallet.balance });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Rewarded ad complete hone par call hoga (AdMob ke server-side verification ke baad ideally)
  app.post("/api/coins/earn-ad", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const AD_REWARD = 20;
      await addCoins(userId, AD_REWARD, "ad_reward");
      const wallet = await getOrCreateWallet(userId);
      res.json({ success: true, earned: AD_REWARD, balance: wallet.balance });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/coins/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rows = await db.execute(sql`
        SELECT * FROM coin_transactions WHERE user_id = ${userId}
        ORDER BY created_at DESC LIMIT 50
      `);
      res.json((rows as any).rows ?? rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GIFTS & COIN PURCHASE (Razorpay)
  // ══════════════════════════════════════════════════════════════════════════

  const { razorpay } = await import("./razorpay");
  const crypto = await import("crypto");

  app.get("/api/coins/packages", async (_req, res) => {
    try {
      const rows = await db.execute(sql`SELECT * FROM coin_packages WHERE is_active = true ORDER BY amount_inr ASC`);
      res.json((rows as any).rows ?? rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/coins/purchase/create-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { packageId } = req.body;
      const pkgRows = await db.execute(sql`SELECT * FROM coin_packages WHERE id = ${packageId} AND is_active = true`);
      const pkg = ((pkgRows as any).rows ?? pkgRows)[0];
      if (!pkg) return res.status(400).json({ message: "Invalid package" });

      const order = await razorpay.orders.create({
        amount: pkg.amount_inr * 100, // paise me
        currency: "INR",
        receipt: `coins_${userId}_${Date.now()}`,
      });

      await db.execute(sql`
        INSERT INTO coin_purchase_orders (user_id, razorpay_order_id, amount_inr, coins, status)
        VALUES (${userId}, ${order.id}, ${pkg.amount_inr}, ${pkg.coins}, 'created')
      `);

      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Order creation failed" });
    }
  });

  app.post("/api/coins/purchase/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      const orderRows = await db.execute(sql`
        SELECT * FROM coin_purchase_orders WHERE razorpay_order_id = ${razorpay_order_id} AND user_id = ${userId}
      `);
      const order = ((orderRows as any).rows ?? orderRows)[0];
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status === "paid") return res.json({ success: true, alreadyProcessed: true });

      await db.execute(sql`
        UPDATE coin_purchase_orders SET status = 'paid', razorpay_payment_id = ${razorpay_payment_id}
        WHERE razorpay_order_id = ${razorpay_order_id}
      `);

      await addCoins(userId, order.coins, "purchase", razorpay_order_id);

      res.json({ success: true, coinsAdded: order.coins });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Verification failed" });
    }
  });

  // ── Gift catalog ──
  app.get("/api/gifts/catalog", async (_req, res) => {
    try {
      const rows = await db.execute(sql`SELECT * FROM gifts_catalog WHERE is_active = true ORDER BY sort_order ASC`);
      res.json((rows as any).rows ?? rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Send a gift (50% creator, 50% app — app ka hissa bas record hota hai, kaata nahi jaata) ──
  app.post("/api/gifts/send", isAuthenticated, async (req: any, res) => {
    try {
      const senderId = req.session.userId;
      const { receiverId, giftId, roomId } = req.body;
      if (!receiverId || !giftId) return res.status(400).json({ message: "receiverId and giftId required" });
      if (receiverId === senderId) return res.status(400).json({ message: "Cannot gift yourself" });

      const giftRows = await db.execute(sql`SELECT * FROM gifts_catalog WHERE id = ${giftId} AND is_active = true`);
      const gift = ((giftRows as any).rows ?? giftRows)[0];
      if (!gift) return res.status(404).json({ message: "Gift not found" });

      const wallet = await getOrCreateWallet(senderId);
      if (wallet.balance < gift.price_coins) {
        return res.status(402).json({ message: "Not enough coins", required: gift.price_coins, balance: wallet.balance });
      }

      // Sender se coins kaato
      await addCoins(senderId, -gift.price_coins, "gift_sent", String(giftId));

      // Creator ko 50% coins milen
      const creatorShare = Math.floor(gift.price_coins / 2);
      await db.execute(sql`
        INSERT INTO creator_earnings (user_id, total_coins_earned) VALUES (${receiverId}, ${creatorShare})
        ON CONFLICT (user_id) DO UPDATE SET total_coins_earned = creator_earnings.total_coins_earned + ${creatorShare}, updated_at = NOW()
      `);
      // Creator apne earned coins ko wallet me bhi use kar sake, wallet me bhi credit karo
      await addCoins(receiverId, creatorShare, "gift_received", String(giftId));

      await db.execute(sql`
        INSERT INTO gift_transactions (sender_id, receiver_id, gift_id, coins_spent, room_id)
        VALUES (${senderId}, ${receiverId}, ${giftId}, ${gift.price_coins}, ${roomId || null})
      `);

      // ── Battle score: gift amount goes to the receiver's team ──
      if (roomId) {
        const roomRows = await db.execute(sql`
          SELECT room_type, battle_status
          FROM voice_rooms
          WHERE id = ${roomId}
        `);
        const roomInfo = ((roomRows as any).rows ?? roomRows)[0];

        if (roomInfo?.battle_status === "active" &&
            (roomInfo.room_type === "1v1" || roomInfo.room_type === "2v2")) {
          const receiverSeatRows = await db.execute(sql`
            SELECT team
            FROM voice_room_seats
            WHERE room_id = ${roomId} AND user_id = ${receiverId}
            LIMIT 1
          `);
          const receiverTeam = ((receiverSeatRows as any).rows ?? receiverSeatRows)[0]?.team;

          if (receiverTeam === "a") {
            await db.execute(sql`
              UPDATE voice_rooms
              SET team_a_score = COALESCE(team_a_score, 0) + ${Number(gift.price_coins)}
              WHERE id = ${roomId} AND battle_status = 'active'
            `);
          } else if (receiverTeam === "b") {
            await db.execute(sql`
              UPDATE voice_rooms
              SET team_b_score = COALESCE(team_b_score, 0) + ${Number(gift.price_coins)}
              WHERE id = ${roomId} AND battle_status = 'active'
            `);
          }

          const updatedRoom = await db.execute(sql`
            SELECT team_a_score, team_b_score
            FROM voice_rooms
            WHERE id = ${roomId}
          `);
          const scores = ((updatedRoom as any).rows ?? updatedRoom)[0];

          const allSeats = await db.execute(sql`
            SELECT user_id FROM voice_room_seats WHERE room_id = ${roomId}
          `);
          ((allSeats as any).rows ?? allSeats).forEach((r: any) => {
            const ws = wsClients.get(String(r.user_id));
            if (ws && ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: "voice_room_battle_score",
                roomId,
                teamAScore: Number(scores?.team_a_score || 0),
                teamBScore: Number(scores?.team_b_score || 0),
              }));
            }
          });
        }
      }

      // Notification bhejo receiver ko
      const sender = await authStorage.getUser(senderId);
      await db.insert(notifications).values({
        userId: receiverId, fromUserId: senderId, type: "gift",
        message: `${sender?.firstName ?? "Someone"} sent you ${gift.icon} ${gift.name}`,
      });

      // WebSocket real-time notify (voice room ke liye)
      const receiverWs = wsClients.get(String(receiverId));
      if (receiverWs && receiverWs.readyState === 1) {
        receiverWs.send(JSON.stringify({
          type: "gift_received", roomId, gift, sender: { firstName: sender?.firstName, profileImageUrl: sender?.profileImageUrl },
        }));
      }

      // Sabko room me bhi dikhao (agar voice room me bheja gaya)
      if (roomId) {
  const giftMsgContent = `🎁 sent ${gift.icon} ${gift.name} to ${receiverId === senderId ? "themselves" : ""}`;
  const msgResult = await db.execute(sql`
    INSERT INTO voice_room_messages (room_id, user_id, content)
    VALUES (${roomId}, ${senderId}, ${giftMsgContent})
    RETURNING *
  `);
  const giftMsg = ((msgResult as any).rows ?? msgResult)[0];
  const seatRows = await db.execute(sql`SELECT user_id FROM voice_room_seats WHERE room_id = ${roomId}`);
  const memberIds = ((seatRows as any).rows ?? seatRows).map((r: any) => r.user_id);
  memberIds.forEach((memberId: string) => {
    const ws = wsClients.get(String(memberId));
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "voice_room_message", roomId,
        message: { ...giftMsg, first_name: sender?.firstName, profile_image_url: sender?.profileImageUrl },
      }));
    }
  });
}
      if (roomId) {
        const seatRows = await db.execute(sql`SELECT user_id FROM voice_room_seats WHERE room_id = ${roomId}`);
        const memberIds = ((seatRows as any).rows ?? seatRows).map((r: any) => r.user_id);
        memberIds.forEach((memberId: string) => {
          const ws = wsClients.get(String(memberId));
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: "voice_room_gift", roomId, gift,
              sender: { firstName: sender?.firstName, profileImageUrl: sender?.profileImageUrl },
              receiver: { userId: receiverId },
            }));
          }
        });
      }

      const newWallet = await getOrCreateWallet(senderId);
      res.json({ success: true, balance: newWallet.balance });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Profile pe dikhane ke liye: kisi user ko kitne gifts mile ──
  app.get("/api/users/:id/gifts-received", async (req, res) => {
    try {
      const userId = req.params.id;
      const rows = await db.execute(sql`
        SELECT g.name, g.icon, COUNT(*) as count, SUM(gt.coins_spent) as total_coins
        FROM gift_transactions gt JOIN gifts_catalog g ON g.id = gt.gift_id
        WHERE gt.receiver_id = ${userId}
        GROUP BY g.id, g.name, g.icon
        ORDER BY total_coins DESC
      `);
      const earningsRows = await db.execute(sql`SELECT total_coins_earned FROM creator_earnings WHERE user_id = ${userId}`);
      const earnings = ((earningsRows as any).rows ?? earningsRows)[0]?.total_coins_earned ?? 0;
      res.json({ gifts: (rows as any).rows ?? rows, totalEarnedCoins: earnings });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
// ══════════════════════════════════════════════════════════════════════════
// WITHDRAWALS (coins → real money, manual payout)
// ══════════════════════════════════════════════════════════════════════════
const COINS_PER_RUPEE = 50;       // 150 coins = ₹3
const MIN_WITHDRAW_COINS = 500;   // ⚠️ assumption — change if you want a different minimum

app.get("/api/withdrawals/mine", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.session.userId;
    const rows = await db.execute(sql`
      SELECT * FROM withdrawal_requests WHERE user_id = ${userId} ORDER BY created_at DESC
    `);
    res.json((rows as any).rows ?? rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/withdrawals/request", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.session.userId;
    const { coins, method, upiId, bankAccountNumber, bankIfsc, bankHolderName } = req.body;

    const coinsNum = Number(coins);
    if (!coinsNum || coinsNum < MIN_WITHDRAW_COINS) {
      return res.status(400).json({ message: `Minimum withdrawal is ${MIN_WITHDRAW_COINS} coins` });
    }
    if (method === "upi" && !upiId) {
      return res.status(400).json({ message: "UPI ID required" });
    }
    if (method === "bank" && (!bankAccountNumber || !bankIfsc || !bankHolderName)) {
      return res.status(400).json({ message: "Bank details incomplete" });
    }

    const wallet = await getOrCreateWallet(userId);
    if (wallet.balance < coinsNum) {
      return res.status(402).json({ message: "Not enough coins", balance: wallet.balance });
    }

    const amountInr = +(coinsNum / COINS_PER_RUPEE).toFixed(2);

    // Coins turant kaat lo (pending state mein) taaki double-withdraw na ho sake
    await addCoins(userId, -coinsNum, "withdrawal_request");

    const result = await db.execute(sql`
      INSERT INTO withdrawal_requests (user_id, coins, amount_inr, method, upi_id, bank_account_number, bank_ifsc, bank_holder_name)
      VALUES (${userId}, ${coinsNum}, ${amountInr}, ${method}, ${upiId || null}, ${bankAccountNumber || null}, ${bankIfsc || null}, ${bankHolderName || null})
      RETURNING *
    `);

    res.status(201).json(((result as any).rows ?? result)[0]);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/withdrawals/:id/status", isAuthenticated, async (req: any, res) => {
   const ADMIN_USER_IDS = ["your-user-id-yahan"]; // ⚠️ apni user id daalo
  if (!ADMIN_USER_IDS.includes(req.session.userId)) {
    return res.status(403).json({ message: "Not allowed" });
  }
  // TODO: yahan apna admin-check lagao (e.g. specific user id ya isAdmin flag)
  const { status, adminNote } = req.body; // 'paid' | 'rejected'
  const id = Number(req.params.id);
  const rows = await db.execute(sql`SELECT * FROM withdrawal_requests WHERE id = ${id}`);
  const wr = ((rows as any).rows ?? rows)[0];
  if (!wr) return res.status(404).json({ message: "Not found" });

  if (status === "rejected" && wr.status === "pending") {
    await addCoins(wr.user_id, wr.coins, "withdrawal_rejected_refund"); // coins wapas
  }
  await db.execute(sql`
    UPDATE withdrawal_requests SET status = ${status}, admin_note = ${adminNote || null},
    paid_at = ${status === "paid" ? new Date() : null} WHERE id = ${id}
  `);
  res.json({ success: true });
});
  // ══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ══════════════════════════════════════════════════════════════════════════

  const PLAN_IDS: Record<string, string> = {
    premium: process.env.RAZORPAY_PLAN_PREMIUM!,
    creator_pro: process.env.RAZORPAY_PLAN_CREATOR_PRO!,
    business: process.env.RAZORPAY_PLAN_BUSINESS!,
  };

  app.get("/api/subscription/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const [row] = await db.select({
        isPro: users.isPro,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionPlan: users.subscriptionPlan,
      }).from(users).where(eq(users.id, userId)).limit(1);

      const subscription = row?.subscriptionStatus === "active"
        ? { plan_type: row.subscriptionPlan || "pro", status: row.subscriptionStatus, is_pro: !!row.isPro }
        : null;

      res.json({ subscription });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subscription/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { planType } = req.body;
      const normalizedPlanType = planType === "pro" ? "pro" : planType;
      const planId = PLAN_IDS[normalizedPlanType];
      if (!normalizedPlanType || !["pro", "creator_pro", "business"].includes(normalizedPlanType)) {
        return res.status(400).json({ message: "Invalid plan type" });
      }

      const [row] = await db.select({ isPro: users.isPro, subscriptionStatus: users.subscriptionStatus }).from(users).where(eq(users.id, userId)).limit(1);
      if (row?.isPro || row?.subscriptionStatus === "active") {
        return res.status(400).json({ message: "You already have an active subscription" });
      }

      if (!planId || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        await db.update(users).set({
          isPro: true,
          subscriptionStatus: "active",
          subscriptionPlan: normalizedPlanType,
          updatedAt: new Date(),
        }).where(eq(users.id, userId));

        return res.json({ success: true, subscriptionId: `local-${normalizedPlanType}`, keyId: process.env.RAZORPAY_KEY_ID || "local" });
      }

      const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        customer_notify: 1,
        total_count: 12,
      });

      await db.update(users).set({
        isPro: true,
        subscriptionStatus: "active",
        subscriptionPlan: normalizedPlanType,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      res.json({ subscriptionId: subscription.id, keyId: process.env.RAZORPAY_KEY_ID });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Subscription creation failed" });
    }
  });

  // Razorpay Dashboard → Webhooks me ye URL add karni hogi (Step 6 me detail)
  app.post(
    "/api/subscription/webhook",
    express.raw({ type: "application/json" }), // raw buffer, NOT parsed JSON
    async (req: any, res) => {
      try {
        const signature = req.headers["x-razorpay-signature"];
        const rawBody = req.body as Buffer; // raw bytes exactly as Razorpay sent

        const expectedSignature = crypto
          .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
          .update(rawBody)
          .digest("hex");

        if (signature !== expectedSignature) {
          return res.status(400).json({ message: "Invalid webhook signature" });
        }

        const payload = JSON.parse(rawBody.toString("utf8"));
        const event = payload.event;
        const subEntity = payload.payload?.subscription?.entity;
        if (!subEntity) return res.json({ received: true });

        if (event === "subscription.activated" || event === "subscription.charged") {
          await db.execute(sql`
            UPDATE users
            SET is_pro = TRUE,
                subscription_status = 'active',
                updated_at = NOW()
            WHERE id = ${payload.payload?.subscription?.entity?.notes?.user_id || payload.payload?.subscription?.entity?.customer_id || ''}
          `);
        }
        if (event === "subscription.cancelled" || event === "subscription.completed" || event === "subscription.halted") {
          await db.execute(sql`
            UPDATE users
            SET is_pro = FALSE,
                subscription_status = 'inactive',
                updated_at = NOW()
            WHERE id = ${payload.payload?.subscription?.entity?.notes?.user_id || payload.payload?.subscription?.entity?.customer_id || ''}
          `);
        }

        res.json({ received: true });
      } catch (err: any) {
        console.error("[subscription webhook]", err);
        res.status(500).json({ message: "Webhook processing failed" });
      }
    }
  );

  app.post("/api/subscription/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const [row] = await db.select({ isPro: users.isPro, subscriptionStatus: users.subscriptionStatus }).from(users).where(eq(users.id, userId)).limit(1);
      if (!row?.isPro || row.subscriptionStatus !== "active") {
        return res.status(404).json({ message: "No active subscription" });
      }

      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        const [sub] = await db.select({ subscriptionPlan: users.subscriptionPlan }).from(users).where(eq(users.id, userId)).limit(1);
        if (sub?.subscriptionPlan) {
          await razorpay.subscriptions.cancel(sub.subscriptionPlan);
        }
      }

      await db.update(users).set({ isPro: false, subscriptionStatus: "cancelled", updatedAt: new Date() }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // VOICE ROOMS + 1v1/2v2 BATTLE
  // ══════════════════════════════════════════════════════════════════════════

  const FREE_JOIN_LIMIT = 3;
  const MAX_SEATS = 12;

  // Battle columns are created here so the new routes do not fail on an older DB.
  // Safe to run on every server start because IF NOT EXISTS is used.
  try {
    await db.execute(sql`ALTER TABLE voice_rooms ADD COLUMN IF NOT EXISTS battle_status VARCHAR(20) DEFAULT 'idle'`);
    await db.execute(sql`ALTER TABLE voice_rooms ADD COLUMN IF NOT EXISTS battle_ends_at TIMESTAMP NULL`);
    await db.execute(sql`ALTER TABLE voice_rooms ADD COLUMN IF NOT EXISTS team_a_score BIGINT DEFAULT 0`);
    await db.execute(sql`ALTER TABLE voice_rooms ADD COLUMN IF NOT EXISTS team_b_score BIGINT DEFAULT 0`);
    await db.execute(sql`ALTER TABLE voice_rooms ADD COLUMN IF NOT EXISTS battle_duration_seconds INTEGER DEFAULT 180`);
    await db.execute(sql`ALTER TABLE voice_room_seats ADD COLUMN IF NOT EXISTS team VARCHAR(1) NULL`);
  } catch (err) {
    console.error("[voice room battle columns]", err);
  }

  const ROOM_TYPE_SEATS: Record<string, number> = {
    "1v1": 2,
    "2v2": 4,
    "group": 8,
  };

  const isBattleRoom = (roomType: any) => roomType === "1v1" || roomType === "2v2";

  // Room banao (host). Host seat #1 is ALWAYS Team A in battle rooms.
  app.post("/api/voice-rooms", isAuthenticated, async (req: any, res: any) => {
    try {
      const hostId = req.session.userId;
      // ── Permanent Voice Room eligibility ──
const userRows = await db.execute(sql`
  SELECT voice_room_unlocked
  FROM users
  WHERE id = ${hostId}
`);

const user = ((userRows as any).rows ?? userRows)[0];

let voiceRoomUnlocked = !!user?.voice_room_unlocked;

// Agar pehle unlock nahi hua, current counts check karo
if (!voiceRoomUnlocked) {
  const videoRows = await db.execute(sql`
    SELECT COUNT(*) AS cnt
    FROM posts
    WHERE user_id = ${hostId}
      AND type = 'video'
  `);

  const postRows = await db.execute(sql`
    SELECT COUNT(*) AS cnt
    FROM posts
    WHERE user_id = ${hostId}
      AND type = 'post'
  `);

  const videoCount = Number(
    ((videoRows as any).rows ?? videoRows)[0]?.cnt ?? 0
  );

  const postCount = Number(
    ((postRows as any).rows ?? postRows)[0]?.cnt ?? 0
  );

  // BOTH required: 4 videos + 3 posts
  if (videoCount >= 4 && postCount >= 3) {
    await db.execute(sql`
      UPDATE users
      SET voice_room_unlocked = TRUE
      WHERE id = ${hostId}
    `);

    voiceRoomUnlocked = true;
  }
}

// Abhi criteria complete nahi hua
if (!voiceRoomUnlocked) {
  return res.status(403).json({
    message: "Voice Room unlocks after 4 videos and 3 posts",
  });
}
      const { title, requiresApproval, roomType } = req.body;
      const normalizedType = ROOM_TYPE_SEATS[roomType] ? roomType : "group";
      const maxSeats = ROOM_TYPE_SEATS[normalizedType];
      const channelName = `room_${hostId}_${Date.now()}`;

      const result = await db.execute(sql`
        INSERT INTO voice_rooms (
          host_id, channel_name, title, join_cost, requires_approval,
          max_seats, room_type, battle_status, team_a_score, team_b_score,
          battle_duration_seconds
        )
        VALUES (
          ${hostId}, ${channelName}, ${title || "Voice Room"}, 0,
          ${!!requiresApproval}, ${maxSeats}, ${normalizedType},
          'idle', 0, 0, 180
        )
        RETURNING *
      `);

      const room = ((result as any).rows ?? result)[0];
      if (!room) return res.status(500).json({ message: "Room creation failed" });

      await db.execute(sql`
        INSERT INTO voice_room_seats (room_id, user_id, seat_number, team)
        VALUES (${room.id}, ${hostId}, 1, ${normalizedType === "1v1" || normalizedType === "2v2" ? "a" : null})
      `);

      res.status(201).json(room);
    } catch (err: any) {
      console.error("[voice room create]", err);
      res.status(500).json({ message: err.message || "Failed to create room" });
    }
  });

  // Active rooms list
  app.get("/api/voice-rooms", isAuthenticated, async (_req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT vr.*, u.first_name, u.last_name, u.username, u.profile_image_url,
          (SELECT COUNT(*) FROM voice_room_seats WHERE room_id = vr.id) AS seat_count
        FROM voice_rooms vr
        JOIN users u ON u.id = vr.host_id
        WHERE vr.is_active = true
        ORDER BY vr.created_at DESC
      `);
      res.json((rows as any).rows ?? rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Room detail + seats + battle state
  app.get("/api/voice-rooms/:id", isAuthenticated, async (req, res) => {
    try {
      const roomId = Number(req.params.id);
      if (!Number.isFinite(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const roomRows = await db.execute(sql`SELECT * FROM voice_rooms WHERE id = ${roomId}`);
      const room = ((roomRows as any).rows ?? roomRows)[0];
      if (!room) return res.status(404).json({ message: "Room not found" });

      const seatRows = await db.execute(sql`
        SELECT s.*, u.first_name, u.last_name, u.username, u.profile_image_url
        FROM voice_room_seats s
        JOIN users u ON u.id = s.user_id
        WHERE s.room_id = ${roomId}
        ORDER BY s.seat_number ASC
      `);

      res.json({ ...room, seats: (seatRows as any).rows ?? seatRows });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Room join karo. 1v1/2v2: seat 1=A, seat 2=B, seat 3=A, seat 4=B...
  app.post("/api/voice-rooms/:id/join", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.session.userId;
      const roomId = Number(req.params.id);
      if (!Number.isFinite(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const roomRows = await db.execute(sql`
        SELECT * FROM voice_rooms WHERE id = ${roomId} AND is_active = true
      `);
      const room = ((roomRows as any).rows ?? roomRows)[0];
      if (!room) return res.status(404).json({ message: "Room not found or ended" });

      if (room.requires_approval && String(room.host_id) !== String(userId)) {
        const approvalRows = await db.execute(sql`
          SELECT status
          FROM voice_room_join_requests
          WHERE room_id = ${roomId} AND user_id = ${userId}
        `);
        const approvalRow = ((approvalRows as any).rows ?? approvalRows)[0];
        if (!approvalRow || approvalRow.status !== "approved") {
          return res.status(403).json({
            message: "This room requires host approval",
            requiresApproval: true,
          });
        }
      }

      const alreadyRows = await db.execute(sql`
        SELECT * FROM voice_room_seats
        WHERE room_id = ${roomId} AND user_id = ${userId}
      `);
      if (((alreadyRows as any).rows ?? alreadyRows).length > 0) {
        return res.json({ success: true, alreadyJoined: true });
      }

      const seatCountRows = await db.execute(sql`
        SELECT COUNT(*) AS cnt FROM voice_room_seats WHERE room_id = ${roomId}
      `);
      const seatCount = parseInt(
        ((seatCountRows as any).rows ?? seatCountRows)[0]?.cnt ?? "0",
        10,
      );
      const roomMaxSeats = Number(room.max_seats ?? 12);
      if (seatCount >= roomMaxSeats) {
        return res.status(400).json({ message: "Room is full" });
      }

      // Joining a voice room is free; coins are spent only on gifts.
      const usedFree = true;
      const nextSeat = seatCount + 1;
      const team = isBattleRoom(room.room_type)
        ? (nextSeat % 2 === 1 ? "a" : "b")
        : null;

      await db.execute(sql`
        INSERT INTO voice_room_seats (room_id, user_id, seat_number, team)
        VALUES (${roomId}, ${userId}, ${nextSeat}, ${team})
      `);

      res.json({ success: true, usedFree, seatNumber: nextSeat, team });
    } catch (err: any) {
      console.error("[voice room join]", err);
      res.status(500).json({ message: err.message || "Failed to join room" });
    }
  });

  // ── Toggle approval requirement (host only) ──
  app.patch("/api/voice-rooms/:id/settings", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.session.userId;
      const roomId = Number(req.params.id);
      const { requiresApproval } = req.body;
      const result = await db.execute(sql`
        UPDATE voice_rooms SET requires_approval = ${!!requiresApproval}
        WHERE id = ${roomId} AND host_id = ${userId}
        RETURNING *
      `);
      const updated = ((result as any).rows ?? result)[0];
      if (!updated) return res.status(403).json({ message: "Not allowed" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Request to join ──
  app.post("/api/voice-rooms/:id/request-join", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.session.userId;
      const roomId = Number(req.params.id);
      const roomRows = await db.execute(sql`
        SELECT * FROM voice_rooms WHERE id = ${roomId} AND is_active = true
      `);
      const room = ((roomRows as any).rows ?? roomRows)[0];
      if (!room) return res.status(404).json({ message: "Room not found" });

      await db.execute(sql`
        INSERT INTO voice_room_join_requests (room_id, user_id, status)
        VALUES (${roomId}, ${userId}, 'pending')
        ON CONFLICT (room_id, user_id)
        DO UPDATE SET status = 'pending', created_at = NOW()
      `);

      const requester = await authStorage.getUser(userId);
      const hostWs = wsClients.get(String(room.host_id));
      if (hostWs && hostWs.readyState === 1) {
        hostWs.send(JSON.stringify({
          type: "voice_room_join_request",
          roomId,
          userId,
          user: {
            firstName: requester?.firstName,
            profileImageUrl: requester?.profileImageUrl,
          },
        }));
      }

      res.json({ success: true, status: "pending" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Pending requests list (host only) ──
  app.get("/api/voice-rooms/:id/join-requests", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.session.userId;
      const roomId = Number(req.params.id);
      const roomRows = await db.execute(sql`SELECT host_id FROM voice_rooms WHERE id = ${roomId}`);
      const room = ((roomRows as any).rows ?? roomRows)[0];
      if (!room || String(room.host_id) !== String(userId)) {
        return res.status(403).json({ message: "Not allowed" });
      }

      const rows = await db.execute(sql`
        SELECT r.*, u.first_name, u.last_name, u.profile_image_url
        FROM voice_room_join_requests r
        JOIN users u ON u.id = r.user_id
        WHERE r.room_id = ${roomId} AND r.status = 'pending'
        ORDER BY r.created_at ASC
      `);
      res.json((rows as any).rows ?? rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Approve / Deny join request (host only) ──
  app.post("/api/voice-rooms/:id/join-requests/:userId/:action", isAuthenticated, async (req: any, res: any) => {
    try {
      const hostId = req.session.userId;
      const roomId = Number(req.params.id);
      const targetUserId = req.params.userId;
      const action = req.params.action;

      if (action !== "approve" && action !== "deny") {
        return res.status(400).json({ message: "Invalid action" });
      }

      const roomRows = await db.execute(sql`SELECT * FROM voice_rooms WHERE id = ${roomId}`);
      const room = ((roomRows as any).rows ?? roomRows)[0];
      if (!room || String(room.host_id) !== String(hostId)) {
        return res.status(403).json({ message: "Not allowed" });
      }

      if (action === "approve") {
        const seatCountRows = await db.execute(sql`
          SELECT COUNT(*) AS cnt FROM voice_room_seats WHERE room_id = ${roomId}
        `);
        const seatCount = parseInt(
          ((seatCountRows as any).rows ?? seatCountRows)[0]?.cnt ?? "0",
          10,
        );
        const roomMaxSeats = Number(room.max_seats ?? 12);
        if (seatCount >= roomMaxSeats) {
          return res.status(400).json({ message: "Room is full" });
        }

        const nextSeat = seatCount + 1;
        const team = isBattleRoom(room.room_type)
          ? (nextSeat % 2 === 1 ? "a" : "b")
          : null;

        await db.execute(sql`
          INSERT INTO voice_room_seats (room_id, user_id, seat_number, team)
          VALUES (${roomId}, ${targetUserId}, ${nextSeat}, ${team})
          ON CONFLICT (room_id, user_id) DO NOTHING
        `);

        await db.execute(sql`
          UPDATE voice_room_join_requests
          SET status = 'approved'
          WHERE room_id = ${roomId} AND user_id = ${targetUserId}
        `);
      } else {
        await db.execute(sql`
          UPDATE voice_room_join_requests
          SET status = 'denied'
          WHERE room_id = ${roomId} AND user_id = ${targetUserId}
        `);
      }

      const targetWs = wsClients.get(String(targetUserId));
      if (targetWs && targetWs.readyState === 1) {
        targetWs.send(JSON.stringify({
          type: "voice_room_join_response",
          roomId,
          approved: action === "approve",
        }));
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("[voice room join request action]", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ── Start battle (host only) ──
  app.post("/api/voice-rooms/:id/battle/start", isAuthenticated, async (req: any, res: any) => {
    try {
      const hostId = req.session.userId;
      const roomId = Number(req.params.id);
      const requestedDuration = Number(req.body?.durationSeconds);

      if (!Number.isFinite(roomId)) {
        return res.status(400).json({ message: "Invalid room id" });
      }

      const roomRows = await db.execute(sql`
        SELECT * FROM voice_rooms WHERE id = ${roomId} AND is_active = true
      `);
      const room = ((roomRows as any).rows ?? roomRows)[0];
      if (!room || String(room.host_id) !== String(hostId)) {
        return res.status(403).json({ message: "Not allowed" });
      }

      if (!isBattleRoom(room.room_type)) {
        return res.status(400).json({ message: "Battle mode only available in 1v1/2v2 rooms" });
      }

      if (room.battle_status === "active") {
        return res.status(400).json({ message: "Battle is already active" });
      }

      const duration = Number.isFinite(requestedDuration) && requestedDuration > 0
        ? Math.min(Math.floor(requestedDuration), 3600)
        : Number(room.battle_duration_seconds || 180);
      const safeDuration = duration > 0 ? duration : 180;
      const endsAt = new Date(Date.now() + safeDuration * 1000);

      await db.execute(sql`
        UPDATE voice_rooms
        SET battle_status = 'active',
            battle_ends_at = ${endsAt},
            team_a_score = 0,
            team_b_score = 0,
            battle_duration_seconds = ${safeDuration}
        WHERE id = ${roomId}
      `);

      const seatRows = await db.execute(sql`
        SELECT user_id FROM voice_room_seats WHERE room_id = ${roomId}
      `);
      const memberIds = ((seatRows as any).rows ?? seatRows).map((r: any) => r.user_id);
      memberIds.forEach((memberId: string) => {
        const ws = wsClients.get(String(memberId));
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: "voice_room_battle_start",
            roomId,
            endsAt: endsAt.toISOString(),
            durationSeconds: safeDuration,
            teamAScore: 0,
            teamBScore: 0,
          }));
        }
      });

      res.json({ success: true, endsAt, durationSeconds: safeDuration });
    } catch (err: any) {
      console.error("[battle start]", err);
      res.status(500).json({ message: err.message || "Failed to start battle" });
    }
  });

  // ── Battle status endpoint (useful after reconnect/page refresh) ──
  app.get("/api/voice-rooms/:id/battle", isAuthenticated, async (req: any, res: any) => {
    try {
      const roomId = Number(req.params.id);
      const roomRows = await db.execute(sql`
        SELECT room_type, battle_status, battle_ends_at, team_a_score, team_b_score
        FROM voice_rooms WHERE id = ${roomId}
      `);
      const room = ((roomRows as any).rows ?? roomRows)[0];
      if (!room) return res.status(404).json({ message: "Room not found" });

      res.json({
        roomId,
        roomType: room.room_type,
        battleStatus: room.battle_status || "idle",
        battleEndsAt: room.battle_ends_at,
        teamAScore: Number(room.team_a_score || 0),
        teamBScore: Number(room.team_b_score || 0),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Force mute a seat (host only) ──
  app.post("/api/voice-rooms/:id/seats/:userId/mute", isAuthenticated, async (req: any, res: any) => {
    try {
      const hostId = req.session.userId;
      const roomId = Number(req.params.id);
      const targetUserId = req.params.userId;
      const { muted } = req.body;

      const roomRows = await db.execute(sql`SELECT host_id FROM voice_rooms WHERE id = ${roomId}`);
      const room = ((roomRows as any).rows ?? roomRows)[0];
      if (!room || String(room.host_id) !== String(hostId)) return res.status(403).json({ message: "Not allowed" });

      await db.execute(sql`
        UPDATE voice_room_seats
        SET is_muted = ${!!muted}
        WHERE room_id = ${roomId} AND user_id = ${targetUserId}
      `);

      const targetWs = wsClients.get(String(targetUserId));
      if (targetWs && targetWs.readyState === 1) {
        targetWs.send(JSON.stringify({ type: "voice_room_force_mute", roomId, muted: !!muted }));
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Kick a user (host only) ──
  app.delete("/api/voice-rooms/:id/seats/:userId", isAuthenticated, async (req: any, res: any) => {
    try {
      const hostId = req.session.userId;
      const roomId = Number(req.params.id);
      const targetUserId = req.params.userId;
      if (String(targetUserId) === String(hostId)) {
        return res.status(400).json({ message: "Host cannot kick themselves" });
      }

      const roomRows = await db.execute(sql`SELECT host_id FROM voice_rooms WHERE id = ${roomId}`);
      const room = ((roomRows as any).rows ?? roomRows)[0];
      if (!room || String(room.host_id) !== String(hostId)) return res.status(403).json({ message: "Not allowed" });

      await db.execute(sql`DELETE FROM voice_room_seats WHERE room_id = ${roomId} AND user_id = ${targetUserId}`);
      await db.execute(sql`DELETE FROM voice_room_join_requests WHERE room_id = ${roomId} AND user_id = ${targetUserId}`);

      const targetWs = wsClients.get(String(targetUserId));
      if (targetWs && targetWs.readyState === 1) {
        targetWs.send(JSON.stringify({ type: "voice_room_kicked", roomId }));
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Room leave karo
  app.post("/api/voice-rooms/:id/leave", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.session.userId;
      const roomId = Number(req.params.id);
      await db.execute(sql`DELETE FROM voice_room_seats WHERE room_id = ${roomId} AND user_id = ${userId}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Host room end kare
  app.post("/api/voice-rooms/:id/end", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.session.userId;
      const roomId = Number(req.params.id);
      const result = await db.execute(sql`
        UPDATE voice_rooms
        SET is_active = false,
            ended_at = NOW(),
            battle_status = CASE WHEN battle_status = 'active' THEN 'ended' ELSE battle_status END
        WHERE id = ${roomId} AND host_id = ${userId}
        RETURNING *
      `);
      const updated = ((result as any).rows ?? result)[0];
      if (!updated) return res.status(403).json({ message: "Not allowed" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Host apna join cost badal sake
  app.patch("/api/voice-rooms/:id/cost", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.session.userId;
      const roomId = Number(req.params.id);
      const { joinCost } = req.body;
      if (joinCost === undefined || Number(joinCost) < 0) {
        return res.status(400).json({ message: "Invalid joinCost" });
      }
      const result = await db.execute(sql`
        UPDATE voice_rooms SET join_cost = ${Number(joinCost)}
        WHERE id = ${roomId} AND host_id = ${userId}
        RETURNING *
      `);
      const updated = ((result as any).rows ?? result)[0];
      if (!updated) return res.status(403).json({ message: "Not allowed" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Battle end checker — har 5 sec mein winner declare karo ──
  setInterval(async () => {
    try {
      const endingRows = await db.execute(sql`
        SELECT id, team_a_score, team_b_score
        FROM voice_rooms
        WHERE battle_status = 'active'
          AND battle_ends_at IS NOT NULL
          AND battle_ends_at <= NOW()
      `);
      const ending = (endingRows as any).rows ?? endingRows;

      for (const room of ending) {
        // Conditional UPDATE prevents duplicate winner broadcasts if two checks overlap.
        const updatedRows = await db.execute(sql`
          UPDATE voice_rooms
          SET battle_status = 'ended'
          WHERE id = ${room.id} AND battle_status = 'active'
          RETURNING team_a_score, team_b_score
        `);
        const updated = ((updatedRows as any).rows ?? updatedRows)[0];
        if (!updated) continue;

        const teamAScore = Number(updated.team_a_score || 0);
        const teamBScore = Number(updated.team_b_score || 0);
        const winner = teamAScore > teamBScore ? "a"
          : teamBScore > teamAScore ? "b"
          : "draw";

        const seatRows = await db.execute(sql`
          SELECT user_id FROM voice_room_seats WHERE room_id = ${room.id}
        `);
        const memberIds = ((seatRows as any).rows ?? seatRows).map((r: any) => r.user_id);

        memberIds.forEach((memberId: string) => {
          const ws = wsClients.get(String(memberId));
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: "voice_room_battle_ended",
              roomId: room.id,
              winner,
              teamAScore,
              teamBScore,
            }));
          }
        });
      }
    } catch (err) {
      console.error("[battle end checker]", err);
    }
  }, 5 * 1000);

  
// Live text chat: message bhejo
  app.post("/api/voice-rooms/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const roomId = Number(req.params.id);
      const { content } = req.body;
      if (!content) return res.status(400).json({ message: "Content required" });
      const result = await db.execute(sql`
        INSERT INTO voice_room_messages (room_id, user_id, content)
        VALUES (${roomId}, ${userId}, ${content})
        RETURNING *
      `);
      const msg = ((result as any).rows ?? result)[0];
      res.status(201).json(msg);

      // WebSocket broadcast — room ke sabhi members ko bhejo
      try {
        const seatRows = await db.execute(sql`SELECT user_id FROM voice_room_seats WHERE room_id = ${roomId}`);
        const memberIds = ((seatRows as any).rows ?? seatRows).map((r: any) => r.user_id);
        const sender = await authStorage.getUser(userId);
        memberIds.forEach((memberId: string) => {
          const ws = wsClients.get(String(memberId));
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: "voice_room_message", roomId, message: {
                ...msg, user: { firstName: sender?.firstName, profileImageUrl: sender?.profileImageUrl }
              }
            }));
          }
        });
      } catch (wsErr) {
        console.error("[voice room message] WS error:", wsErr);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Live text chat: messages fetch karo
  app.get("/api/voice-rooms/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const roomId = Number(req.params.id);
      const rows = await db.execute(sql`
        SELECT m.*, u.first_name, u.last_name, u.profile_image_url
        FROM voice_room_messages m JOIN users u ON u.id = m.user_id
        WHERE m.room_id = ${roomId} ORDER BY m.created_at ASC LIMIT 100
      `);
      res.json((rows as any).rows ?? rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
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

  return httpServer;
}