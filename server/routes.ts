import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authStorage } from "./replit_integrations/auth/storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { api } from "@shared/routes";
import { z } from "zod";
import { users } from "@shared/models/auth";
import { posts, comments, ads } from "@shared/schema";
import { db } from "./db";
import { sql, eq, desc } from "drizzle-orm";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "uploads", "videos");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const chunksDir = path.join(process.cwd(), "uploads", "chunks");
if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });

// Multer for individual chunks — each chunk must be ≤6 MB so the proxy never 413s.
// NOTE: req.body fields may not be populated yet during multer's filename callback
// when the file field appears first in the FormData stream, so we use a temp name
// and rename the file inside the route handler once req.body is fully available.
const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, chunksDir),
    filename: (_req, _file, cb) => {
      cb(null, `tmp-chunk-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024 }, // 6 MB per chunk
});

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".3gp", ".flv", ".wmv", ".ts"]);
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB limit
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isVideoMime = file.mimetype.startsWith("video/") || file.mimetype === "application/octet-stream";
    const isVideoExt = VIDEO_EXTENSIONS.has(ext);
    if (isVideoMime || isVideoExt) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype} (${ext})`));
  },
});

const bookUploadsDir = path.join(process.cwd(), "uploads", "books");
if (!fs.existsSync(bookUploadsDir)) fs.mkdirSync(bookUploadsDir, { recursive: true });

const bookUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, bookUploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".pdf";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) cb(null, true);
    else cb(new Error("Only PDF files allowed"));
  },
});

async function seed() {
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) return;

  console.log("Seeding database...");

  // Seed users (password: "password123" for all)
  const bcrypt = await import("bcryptjs");
  const hashed = await bcrypt.hash("password123", 10);
  const [user1] = await db.insert(users).values({
      email: "alice@example.com",
      password: hashed,
      firstName: "Alice",
      lastName: "Wonder",
      username: "alicewonder7842",
      isCelebrity: true,
      profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
  }).returning();

  const [user2] = await db.insert(users).values({
      email: "bob@example.com",
      password: hashed,
      firstName: "Bob",
      lastName: "Builder",
      username: "bobbuilder3516",
      profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
  }).returning();

  // Seed posts
  const [post1] = await db.insert(posts).values({ 
    userId: user1.id, 
    imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb", 
    caption: "Yosemite is breathtaking! 🏞️ #nature #travel", 
    type: "post" 
  }).returning();

  const [post2] = await db.insert(posts).values({ 
    userId: user2.id, 
    imageUrl: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe", 
    caption: "Healthy breakfast to start the day 🥑🍳", 
    type: "post" 
  }).returning();
  
  const [post3] = await db.insert(posts).values({ 
    userId: user1.id, 
    imageUrl: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba", 
    caption: "Starry nights ✨", 
    type: "post" 
  }).returning();

  // Seed comments
  await db.insert(comments).values([
    { postId: post1.id, userId: user2.id, content: "Wow, amazing shot!" },
    { postId: post2.id, userId: user1.id, content: "Looks delicious!" },
  ]);
  
  // Seed Ads
  const existingAds = await db.select().from(ads).limit(1);
  if (existingAds.length === 0) {
    await db.insert(ads).values([
      {
        title: "Summer Collection 2026",
        description: "Check out our new sustainable summer outfits. Shop now!",
        linkUrl: "https://example.com/shop",
        type: "native",
        placement: "feed",
        imageUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800"
      },
      {
        title: "LITLink Premium",
        description: "Get rid of ads and unlock exclusive 3D pets!",
        linkUrl: "https://replit.com",
        type: "banner",
        placement: "feed",
        imageUrl: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=200"
      },
      {
        title: "Master TypeScript",
        description: "New advanced course available. Enroll today for 50% off.",
        linkUrl: "https://example.com/learn",
        type: "banner",
        placement: "reading",
        imageUrl: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=200"
      },
      {
        title: "Amazing Travel App",
        description: "Plan your next adventure with ease. Free download.",
        linkUrl: "https://example.com/travel",
        type: "interstitial",
        placement: "transition",
        imageUrl: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1080"
      }
    ]);
  }

  console.log("Database seeded!");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // Check if email exists (for forgot password flow)
  app.get("/api/users/check-email", async (req, res) => {
    const email = ((req.query.email as string) || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "Email is required" });
    const { eq } = await import("drizzle-orm");
    const found = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!found.length) return res.status(404).json({ message: "No account found with that email address" });
    res.json({ exists: true });
  });

  // Reset Password — verify email exists, then update password
  app.post("/api/auth/reset-password", async (req, res) => {
    const { email, newPassword } = req.body as { email?: string; newPassword?: string };
    if (!email || !newPassword) return res.status(400).json({ message: "Email and new password are required" });
    if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    const { eq } = await import("drizzle-orm");
    const found = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    if (!found.length) return res.status(404).json({ message: "No account found with that email address" });
    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ password: hashed }).where(eq(users.email, email.toLowerCase().trim()));
    res.json({ message: "Password updated successfully" });
  });

  // Setup Integrations
  registerChatRoutes(app);
  registerImageRoutes(app);

  // Seed Data
  seed().catch(console.error);

  // Posts
  app.get(api.posts.list.path, isAuthenticated, async (req, res) => {
    const allPosts = await storage.getAllPosts();
    // Optional userId filter for profile views
    const filterUserId = req.query.userId as string | undefined;
    const posts = filterUserId ? allPosts.filter(p => p.userId === filterUserId) : allPosts;
    // Enrich with user data and likes (inefficient N+1 but ok for MVP)
    const enrichedPosts = await Promise.all(posts.map(async (post) => {
      const user = await authStorage.getUser(post.userId);
      const likesCount = await storage.getLikesCount(post.id);
      const comments = await storage.getComments(post.id);
      const hasLiked = await storage.hasLiked(post.id, (req.session as any).userId);
      return {
        ...post,
        user,
        likesCount,
        commentsCount: comments.length,
        hasLiked
      };
    }));
    res.json(enrichedPosts);
  });

  app.post(api.posts.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.posts.create.input.parse(req.body);
      const post = await storage.createPost({
        ...input,
        userId: (req.session as any).userId
      });
      res.status(201).json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.posts.get.path, isAuthenticated, async (req, res) => {
    const post = await storage.getPost(Number(req.params.id));
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const user = await authStorage.getUser(post.userId);
    const likesCount = await storage.getLikesCount(post.id);
    const comments = await storage.getComments(post.id);
    const hasLiked = await storage.hasLiked(post.id, (req.session as any).userId);
    
    res.json({
      ...post,
      user,
      likesCount,
      commentsCount: comments.length,
      hasLiked
    });
  });

  app.post(api.posts.like.path, isAuthenticated, async (req, res) => {
    const postId = Number(req.params.id);
    const userId = (req.session as any).userId;
    const { added, count } = await storage.toggleLike(postId, userId);
    // Send notification to post author when liked (not when unliked)
    if (added) {
      try {
        const post = await storage.getPost(postId);
        if (post && post.userId !== userId) {
          const liker = await authStorage.getUser(userId);
          await db.execute(sql`
            INSERT INTO notifications (user_id, from_user_id, type, message, post_id)
            VALUES (${post.userId}, ${userId}, 'like', ${`${liker?.firstName ?? "Someone"} liked your post`}, ${postId})
          `);
        }
      } catch {}
    }
    res.json({ success: true, likesCount: count, added });
  });

  app.post(api.posts.comment.path, isAuthenticated, async (req, res) => {
    const postId = Number(req.params.id);
    const userId = (req.session as any).userId;
    const { content } = req.body;
    
    if (!content) return res.status(400).json({ message: "Content required" });

    const comment = await storage.createComment(postId, userId, content);
    res.status(201).json(comment);
  });

  // DELETE a post (owner only)
  app.delete("/api/posts/:id", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const postId = Number(req.params.id);
    const deleted = await storage.deletePost(postId, userId);
    if (!deleted) return res.status(403).json({ message: "Not allowed or post not found" });
    res.json({ success: true });
  });

  // SAVE / UNSAVE a post (bookmark toggle)
  app.post("/api/posts/:id/save", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const postId = Number(req.params.id);
    const existing = await db.execute(
      sql`SELECT id FROM saved_posts WHERE user_id = ${userId} AND post_id = ${postId}`
    );
    if (existing.rows.length > 0) {
      await db.execute(sql`DELETE FROM saved_posts WHERE user_id = ${userId} AND post_id = ${postId}`);
      return res.json({ saved: false });
    } else {
      await db.execute(sql`INSERT INTO saved_posts (user_id, post_id) VALUES (${userId}, ${postId}) ON CONFLICT DO NOTHING`);
      return res.json({ saved: true });
    }
  });

  // GET all saved posts for the current user
  app.get("/api/posts/saved", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const rows = await db.execute(
      sql`SELECT sp.post_id FROM saved_posts sp WHERE sp.user_id = ${userId} ORDER BY sp.created_at DESC`
    );
    const postIds = rows.rows.map((r: any) => r.post_id as number);
    res.json({ postIds });
  });

  // REPORT a post
  app.post("/api/posts/:id/report", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const postId = Number(req.params.id);
    const { reason } = req.body as { reason?: string };
    if (!reason) return res.status(400).json({ message: "Reason is required" });
    await storage.reportPost(postId, userId, reason);
    res.json({ success: true });
  });

  // GET comments for a post
  app.get("/api/posts/:id/comments", isAuthenticated, async (req, res) => {
    const postId = Number(req.params.id);
    const commentList = await storage.getComments(postId);
    // Attach user info
    const withUsers = await Promise.all(commentList.map(async (c) => {
      const u = await authStorage.getUser(c.userId);
      return { ...c, user: u ? { firstName: u.firstName, lastName: u.lastName, profileImageUrl: u.profileImageUrl } : null };
    }));
    res.json(withUsers);
  });

  // User search
  app.get("/api/users/blocked", isAuthenticated, async (req: any, res) => {
    const ids = await storage.getBlockedUsers(req.session.userId);
    res.json({ blockedIds: ids });
  });

  app.get("/api/users/search", isAuthenticated, async (req, res) => {
    const q = ((req.query.q as string) || "").toLowerCase().trim();
    const allUsers = await db.select().from(users);
    const me = (req.session as any).userId;
    const filtered = allUsers.filter(u => u.id !== me && (
      !q || (u.firstName + " " + u.lastName).toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    ));
    res.json(filtered);
  });

  // Users
  app.get(api.users.get.path, isAuthenticated, async (req, res) => {
    const userId = req.params.id as string;
    const user = await authStorage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  });

  // Books & News
  app.get("/api/books", isAuthenticated, async (req, res) => {
    const type = req.query.type as string;
    const books = await storage.getBooks(type);
    res.json(books);
  });

  app.post("/api/books", isAuthenticated, async (req, res) => {
    const book = await storage.createBook({ ...req.body, content: req.body.content || "" });
    res.status(201).json(book);
  });

  // PDF upload for books
  app.post("/api/upload/book-pdf", isAuthenticated, bookUpload.single("pdf"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No PDF file uploaded" });
    const fileUrl = `/uploads/books/${req.file.filename}`;
    res.json({ pdfUrl: fileUrl });
  });

  // Ads
  app.get("/api/ads/:placement", isAuthenticated, async (req, res) => {
    const placement = req.params.placement as string;
    const ads = await storage.getAdsByPlacement(placement);
    res.json(ads);
  });

  app.post("/api/ads", isAuthenticated, async (req, res) => {
    const ad = await storage.createAd(req.body);
    res.status(201).json(ad);
  });

  // History
  app.get("/api/history", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const history = await storage.getHistory(userId);
    res.json(history);
  });

  app.post("/api/history", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const entry = await storage.createHistory({ ...req.body, userId });
    res.status(201).json(entry);
  });

  // ── XP / Level ───────────────────────────────────────────────────────────
  app.get("/api/profile/xp", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;

    // Count posts by type
    const userPosts = await db.select().from(posts).where(eq(posts.userId, userId));

    let postXP = 0;
    for (const p of userPosts) {
      if (p.type === "reel")        postXP += 150;
      else if (p.type === "story")  postXP += 50;
      else if (p.type === "video")  postXP += 120;
      else                          postXP += 100; // photo / post
    }

    // Likes received on user's posts
    let likesXP = 0;
    for (const p of userPosts) {
      const count = await storage.getLikesCount(p.id);
      likesXP += count * 5;
    }

    // Comments received on user's posts
    let commentsReceivedXP = 0;
    for (const p of userPosts) {
      const comms = await storage.getComments(p.id);
      commentsReceivedXP += comms.filter(c => c.userId !== userId).length * 10;
    }

    // Comments the user has made on others' posts
    const userComments = await db.select().from(comments).where(eq(comments.userId, userId));
    const commentsMadeXP = userComments.length * 3;

    const totalXP = postXP + likesXP + commentsReceivedXP + commentsMadeXP;
    const XP_PER_LEVEL = 500;
    const level = Math.floor(totalXP / XP_PER_LEVEL) + 1;
    const xpInLevel = totalXP % XP_PER_LEVEL;

    res.json({
      totalXP,
      xpInLevel,
      xpMax: XP_PER_LEVEL,
      level,
      breakdown: {
        posts: postXP,
        likesReceived: likesXP,
        commentsReceived: commentsReceivedXP,
        commentsMade: commentsMadeXP,
      },
    });
  });

  // ── Update own profile ────────────────────────────────────────────────────
  app.patch("/api/profile", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const { firstName, lastName, username, bio, profileImageUrl } = req.body;
    const existing = await authStorage.getUser(userId);
    if (!existing) return res.status(404).json({ message: "User not found" });
    // If username is changing, check it's not taken by another user
    if (username && username !== (existing as any).username) {
      const taken = await db.select({ id: users.id }).from(users)
        .where(eq(users.username, username)).limit(1);
      if (taken.length > 0 && taken[0].id !== userId) {
        return res.status(409).json({ message: "That username is already taken." });
      }
    }
    const updated = await authStorage.upsertUser({
      ...existing,
      firstName: firstName ?? existing.firstName,
      lastName: lastName ?? existing.lastName,
      username: username ?? (existing as any).username,
      bio: bio ?? (existing as any).bio,
      profileImageUrl: profileImageUrl ?? existing.profileImageUrl,
    });
    const { password: _, ...safeUser } = updated as any;
    res.json(safeUser);
  });

  // ── Users list (for new chat) ─────────────────────────────────────────────
  app.get("/api/users", isAuthenticated, async (req, res) => {
    const allUsers = await db.select().from(users);
    const me = (req.session as any).userId;
    res.json(allUsers.filter(u => u.id !== me));
  });

  // Get a single user by ID (for OtherUserProfile)
  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    const user = await authStorage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { password: _, ...safeUser } = user as any;

    // Real follower / following / post counts
    const followersRow = await db.execute(sql`SELECT COUNT(*) AS cnt FROM follows WHERE following_id = ${req.params.id}`);
    const followingRow = await db.execute(sql`SELECT COUNT(*) AS cnt FROM follows WHERE follower_id  = ${req.params.id}`);
    const postsRow    = await db.execute(sql`SELECT COUNT(*) AS cnt FROM posts WHERE user_id = ${req.params.id} AND type NOT IN ('live')`);

    const followersCount = parseInt(((followersRow as any).rows ?? followersRow as any)[0]?.cnt ?? "0");
    const followingCount = parseInt(((followingRow as any).rows ?? followingRow as any)[0]?.cnt ?? "0");
    const postsCount    = parseInt(((postsRow     as any).rows ?? postsRow     as any)[0]?.cnt ?? "0");

    res.json({ ...safeUser, followersCount, followingCount, postsCount });
  });

  // ── Online status ─────────────────────────────────────────────────────────
  app.post("/api/status/online", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    await storage.setOnlineStatus(userId, true);
    res.json({ ok: true });
  });

  app.post("/api/status/offline", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    await storage.setOnlineStatus(userId, false);
    res.json({ ok: true });
  });

  app.get("/api/status/:userId", isAuthenticated, async (req, res) => {
    const status = await storage.getOnlineStatus(req.params.userId as string);
    res.json(status);
  });

  // ── Direct chats ──────────────────────────────────────────────────────────
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

  // ── Messages ──────────────────────────────────────────────────────────────
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
      chatId, senderId: userId, content, type: type || "text",
      mediaUrl, metadata, replyToId,
      ...(expiresAt ? { expiresAt } : {}),
    });
    // Notify the other participant in the chat
    try {
      const chatRows = await db.execute(sql`SELECT user1_id, user2_id FROM direct_chats WHERE id = ${chatId}`);
      const chat = ((chatRows as any).rows ?? chatRows as any)[0];
      if (chat) {
        const recipientId = chat.user1_id === userId ? chat.user2_id : chat.user1_id;
        const sender = await authStorage.getUser(userId);
        const preview = (content ?? "").slice(0, 50);
        await db.execute(sql`
          INSERT INTO notifications (user_id, from_user_id, type, message)
          VALUES (${recipientId}, ${userId}, 'message', ${`${sender?.firstName ?? "Someone"} sent you a message${preview ? `: "${preview}"` : ""}`})
        `);
      }
    } catch {}
    res.status(201).json(msg);
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

  app.delete("/api/messages/:id", isAuthenticated, async (req, res) => {
    await storage.deleteMessage(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Typing indicator ──────────────────────────────────────────────────────
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

  // ── AI: Translate message ─────────────────────────────────────────────────
  app.post("/api/translate", isAuthenticated, async (req, res) => {
    const { text, targetLang } = req.body;
    if (!text) return res.status(400).json({ message: "text required" });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: `Translate the following text to ${targetLang || "English"}. Reply with only the translated text:\n\n${text}` }],
      max_tokens: 300,
    });
    res.json({ translated: completion.choices[0].message.content });
  });

  // ── AI: Smart reply suggestions ───────────────────────────────────────────
  app.post("/api/smart-reply", isAuthenticated, async (req, res) => {
    const { lastMessage } = req.body;
    if (!lastMessage) return res.status(400).json({ message: "lastMessage required" });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: `Generate 3 short, natural reply suggestions for this message: "${lastMessage}". Reply with a JSON array of strings, no other text.` }],
      max_tokens: 100,
    });
    try {
      const raw = completion.choices[0].message.content ?? "[]";
      const suggestions = JSON.parse(raw.replace(/```json|```/g, "").trim());
      res.json({ suggestions });
    } catch {
      res.json({ suggestions: ["👍", "Got it!", "Thanks!"] });
    }
  });

  // ── Group chats ───────────────────────────────────────────────────────────
  app.get("/api/group-chats", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const groups = await storage.getGroupChats(userId);
    res.json(groups);
  });

  app.post("/api/group-chats", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const { name, memberIds } = req.body;
    if (!name) return res.status(400).json({ message: "name required" });
    const group = await storage.createGroupChat({ name, createdBy: userId }, [userId, ...(memberIds || [])]);
    res.status(201).json(group);
  });

  // ── Audio Proxy (bypasses CORS on external audio sources) ────────────────
  app.get("/api/audio-proxy", async (req: any, res) => {
    const url = req.query.url as string;
    const ALLOWED_HOSTS = ["www.soundhelix.com", "cdn.pixabay.com", "freemusicarchive.org", "upload.wikimedia.org"];
    let hostname = "";
    try { hostname = new URL(url).hostname; } catch { return res.status(400).json({ message: "Invalid URL" }); }
    if (!url || !ALLOWED_HOSTS.includes(hostname)) return res.status(400).json({ message: "Disallowed audio source" });
    try {
      const https = await import("https");
      const http = await import("http");
      const proto = url.startsWith("https://") ? https : http;
      proto.get(url, (upstream) => {
        if (upstream.statusCode !== 200) {
          return res.status(upstream.statusCode || 502).json({ message: "Audio source returned error" });
        }
        res.setHeader("Content-Type", upstream.headers["content-type"] || "audio/mpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (upstream.headers["content-length"]) {
          res.setHeader("Content-Length", upstream.headers["content-length"]);
        }
        upstream.pipe(res);
      }).on("error", () => res.status(502).json({ message: "Failed to fetch audio" }));
    } catch (err) {
      res.status(500).json({ message: "Audio proxy error" });
    }
  });

  // ── Video Upload (real file to disk) ─────────────────────────────────────
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
    maxAge: "7d",
    acceptRanges: true,
  }));

  app.post("/api/upload/video", isAuthenticated, (req: any, res) => {
    videoUpload.single("video")(req, res, (err: any) => {
      if (err) {
        console.error("[video upload error]", err.message || err);
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ message: "File too large. Maximum size is 5 GB." });
        }
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
      if (!req.file) {
        console.error("[video upload] No file received in request");
        return res.status(400).json({ message: "No video file received. Please select a video file." });
      }
      const fileUrl = `/uploads/videos/${req.file.filename}`;
      console.log(`[video upload] saved: ${req.file.filename} (${Math.round(req.file.size / 1024)}KB)`);
      res.json({ url: fileUrl, filename: req.file.filename, size: req.file.size });
    });
  });

  // ── Chunked video upload ──────────────────────────────────────────────────
  // Upload a single 4 MB chunk.  Each request is tiny so the proxy never 413s.
  app.post("/api/upload/chunk", isAuthenticated, (req: any, res) => {
    chunkUpload.single("chunk")(req, res, (err: any) => {
      if (err) {
        console.error("[chunk upload error]", err.message || err);
        return res.status(400).json({ message: err.message || "Chunk upload failed" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "No chunk data received" });
      }
      // req.body is now fully available after multer has finished parsing
      const { uploadId, chunkIndex, totalChunks } = req.body;
      if (!uploadId || chunkIndex === undefined) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: "Missing uploadId or chunkIndex" });
      }
      // Rename temp file to its proper chunk name so finalize can find it in order
      const properName = `${uploadId}-chunk-${String(chunkIndex).padStart(6, "0")}`;
      const properPath = path.join(chunksDir, properName);
      try {
        fs.renameSync(req.file.path, properPath);
      } catch (renameErr: any) {
        console.error("[chunk rename error]", renameErr.message);
        return res.status(500).json({ message: "Failed to save chunk" });
      }
      console.log(`[chunk] ${uploadId} chunk ${chunkIndex}/${Number(totalChunks) - 1} saved (${Math.round(req.file.size / 1024)} KB)`);
      res.json({ received: true, chunkIndex: Number(chunkIndex) });
    });
  });

  // Assemble all chunks into the final video file once every chunk has arrived.
  app.post("/api/upload/finalize", isAuthenticated, async (req: any, res) => {
    const { uploadId, totalChunks, originalName } = req.body;
    if (!uploadId || !totalChunks || !originalName) {
      return res.status(400).json({ message: "Missing uploadId, totalChunks, or originalName" });
    }
    const ext = path.extname(String(originalName)).toLowerCase() || ".mp4";
    const finalFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const finalPath = path.join(uploadsDir, finalFilename);
    try {
      const writeStream = fs.createWriteStream(finalPath);
      const n = Number(totalChunks);
      for (let i = 0; i < n; i++) {
        const chunkPath = path.join(chunksDir, `${uploadId}-chunk-${String(i).padStart(6, "0")}`);
        if (!fs.existsSync(chunkPath)) {
          writeStream.destroy();
          fs.unlink(finalPath, () => {});
          return res.status(400).json({ message: `Missing chunk ${i}` });
        }
        const data = fs.readFileSync(chunkPath);
        writeStream.write(data);
        fs.unlink(chunkPath, () => {}); // clean up chunk immediately
      }
      writeStream.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
      const stats = fs.statSync(finalPath);
      console.log(`[finalize] ${finalFilename} assembled (${Math.round(stats.size / 1024 / 1024)} MB)`);
      res.json({ url: `/uploads/videos/${finalFilename}`, filename: finalFilename, size: stats.size });
    } catch (err: any) {
      console.error("[finalize error]", err.message || err);
      fs.unlink(finalPath, () => {});
      res.status(500).json({ message: "Failed to assemble video" });
    }
  });

  // ── Follow / Unfollow ─────────────────────────────────────────────────────
  app.post("/api/users/:id/follow", isAuthenticated, async (req: any, res) => {
    const followerId = req.session.userId;
    const followingId = req.params.id;
    if (followerId === followingId) return res.status(400).json({ message: "Cannot follow yourself" });
    try {
      await db.execute(sql`
        INSERT INTO follows (follower_id, following_id) VALUES (${followerId}, ${followingId})
        ON CONFLICT DO NOTHING
      `);
      // Create notification for the followed user
      const follower = await authStorage.getUser(followerId);
      await db.execute(sql`
        INSERT INTO notifications (user_id, from_user_id, type, message)
        VALUES (${followingId}, ${followerId}, 'follow', ${`${follower?.firstName ?? "Someone"} started following you`})
      `);
      res.json({ following: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to follow" });
    }
  });

  // Notify a user of an incoming call
  app.post("/api/users/:id/call-notify", isAuthenticated, async (req: any, res) => {
    const callerId = req.session.userId;
    const calleeId = req.params.id;
    if (callerId === calleeId) return res.json({ ok: true });
    try {
      const caller = await authStorage.getUser(callerId);
      const { audioOnly } = req.body;
      const callType = audioOnly ? "voice call" : "video call";
      await db.execute(sql`
        INSERT INTO notifications (user_id, from_user_id, type, message)
        VALUES (${calleeId}, ${callerId}, 'call', ${`${caller?.firstName ?? "Someone"} is calling you — ${callType}`})
      `);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ ok: false });
    }
  });

  app.delete("/api/users/:id/follow", isAuthenticated, async (req: any, res) => {
    const followerId = req.session.userId;
    const followingId = req.params.id;
    await db.execute(sql`DELETE FROM follows WHERE follower_id = ${followerId} AND following_id = ${followingId}`);
    res.json({ following: false });
  });

  // ── Block / Unblock ────────────────────────────────────────────────────────
  app.post("/api/users/:id/block", isAuthenticated, async (req: any, res) => {
    const blockerId = req.session.userId;
    const blockedId = req.params.id;
    if (blockerId === blockedId) return res.status(400).json({ message: "Cannot block yourself" });
    await storage.blockUser(blockerId, blockedId);
    // Also unfollow in both directions
    await db.execute(sql`DELETE FROM follows WHERE (follower_id = ${blockerId} AND following_id = ${blockedId}) OR (follower_id = ${blockedId} AND following_id = ${blockerId})`);
    res.json({ blocked: true });
  });

  app.delete("/api/users/:id/block", isAuthenticated, async (req: any, res) => {
    const blockerId = req.session.userId;
    await storage.unblockUser(blockerId, req.params.id);
    res.json({ blocked: false });
  });

  app.get("/api/users/:id/block-status", isAuthenticated, async (req: any, res) => {
    const blocked = await storage.isBlocked(req.session.userId, req.params.id);
    const blockedByThem = await storage.isBlocked(req.params.id, req.session.userId);
    res.json({ blocked, blockedByThem });
  });


  app.get("/api/users/:id/follow-status", isAuthenticated, async (req: any, res) => {
    const followerId = req.session.userId;
    const followingId = req.params.id;
    const rows = await db.execute(sql`
      SELECT id FROM follows WHERE follower_id = ${followerId} AND following_id = ${followingId} LIMIT 1
    `);
    const isFollowing = ((rows as any).rows ?? rows as any).length > 0;
    res.json({ following: isFollowing });
  });

  app.get("/api/users/:id/followers", isAuthenticated, async (req: any, res) => {
    const rows = await db.execute(sql`
      SELECT follower_id FROM follows WHERE following_id = ${req.params.id}
    `);
    const followerIds = ((rows as any).rows ?? rows as any).map((r: any) => r.follower_id);
    const followerUsers = await Promise.all(followerIds.map((id: string) => authStorage.getUser(id)));
    res.json(followerUsers.filter(Boolean));
  });

  app.get("/api/users/:id/following", isAuthenticated, async (req: any, res) => {
    const rows = await db.execute(sql`
      SELECT following_id FROM follows WHERE follower_id = ${req.params.id}
    `);
    const ids = ((rows as any).rows ?? rows as any).map((r: any) => r.following_id);
    const followingUsers = await Promise.all(ids.map((id: string) => authStorage.getUser(id)));
    res.json(followingUsers.filter(Boolean));
  });

  // ── Notifications ─────────────────────────────────────────────────────────
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    const userId = req.session.userId;
    const rows = await db.execute(sql`
      SELECT n.*, u.first_name, u.last_name, u.username, u.profile_image_url
      FROM notifications n
      LEFT JOIN users u ON u.id = n.from_user_id
      WHERE n.user_id = ${userId}
      ORDER BY n.created_at DESC LIMIT 50
    `);
    res.json((rows as any).rows ?? rows);
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    const userId = req.session.userId;
    await db.execute(sql`UPDATE notifications SET read = true WHERE user_id = ${userId}`);
    res.json({ success: true });
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    const userId = req.session.userId;
    const rows = await db.execute(sql`SELECT COUNT(*) as count FROM notifications WHERE user_id = ${userId} AND read = false`);
    const count = parseInt(((rows as any).rows?.[0] ?? (rows as any)[0])?.count ?? "0");
    res.json({ count });
  });

  // ── Live Stream ────────────────────────────────────────────────────────────
  app.post("/api/live/start", isAuthenticated, async (req: any, res) => {
    const userId = req.session.userId;
    const { title, thumbnail } = req.body;

    // Create a real "live" post in DB
    const post = await storage.createPost({
      userId,
      imageUrl: thumbnail || `https://api.dicebear.com/7.x/shapes/svg?seed=${userId}&size=400`,
      caption: title || "Live Stream",
      type: "live",
    });

    // Notify all followers that this user is live
    const user = await authStorage.getUser(userId);
    const followerRows = await db.execute(sql`SELECT follower_id FROM follows WHERE following_id = ${userId}`);
    const followers = ((followerRows as any).rows ?? followerRows as any) as any[];
    for (const f of followers) {
      await db.execute(sql`
        INSERT INTO notifications (user_id, from_user_id, type, message, post_id)
        VALUES (${f.follower_id}, ${userId}, 'live', ${`${user?.firstName ?? "Someone"} is now LIVE! Tap to watch`}, ${post.id})
      `);
    }

    res.json({ post, viewerCount: 0 });
  });

  app.post("/api/live/end/:postId", isAuthenticated, async (req: any, res) => {
    const postId = Number(req.params.postId);
    await db.execute(sql`UPDATE posts SET type = 'video', live_ended_at = NOW() WHERE id = ${postId}`);
    res.json({ success: true });
  });

  app.get("/api/live/active", isAuthenticated, async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT p.*, u.first_name, u.last_name, u.username, u.profile_image_url,
             u.first_name || ' ' || u.last_name AS display_name
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.type = 'live'
      ORDER BY p.created_at DESC
    `);
    res.json((rows as any).rows ?? rows);
  });

  // ── Reel Songs (songs used in public reels) ────────────────────────────────
  app.get("/api/posts/reel-songs", isAuthenticated, async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT p.id, p.song_title, p.song_artist, p.song_color,
             u.username, u.first_name, p.created_at
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.type = 'reel'
        AND p.song_title IS NOT NULL
        AND p.song_title != ''
      ORDER BY p.created_at DESC
      LIMIT 30
    `);
    res.json((rows as any).rows ?? rows);
  });

  return httpServer;
}
