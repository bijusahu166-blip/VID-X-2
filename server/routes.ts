import type { Express } from "express";
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
import OpenAI from "openai";

async function seed() {
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) return;

  console.log("Seeding database...");

  // Seed users
  const [user1] = await db.insert(users).values({
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Wonder",
      isCelebrity: true,
      profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
  }).returning();

  const [user2] = await db.insert(users).values({
      email: "bob@example.com",
      firstName: "Bob",
      lastName: "Builder",
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

  // Setup Integrations
  registerChatRoutes(app);
  registerImageRoutes(app);

  // Seed Data
  seed().catch(console.error);

  // Posts
  app.get(api.posts.list.path, isAuthenticated, async (req, res) => {
    const posts = await storage.getAllPosts();
    // Enrich with user data and likes (inefficient N+1 but ok for MVP)
    const enrichedPosts = await Promise.all(posts.map(async (post) => {
      const user = await authStorage.getUser(post.userId);
      const likesCount = await storage.getLikesCount(post.id);
      const comments = await storage.getComments(post.id);
      const hasLiked = req.user ? await storage.hasLiked(post.id, (req.user as any).claims.sub) : false;
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
        userId: (req.user as any).claims.sub
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
    const hasLiked = req.user ? await storage.hasLiked(post.id, (req.user as any).claims.sub) : false;
    
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
    const userId = (req.user as any).claims.sub;
    const { added, count } = await storage.toggleLike(postId, userId);
    res.json({ success: true, likesCount: count, added });
  });

  app.post(api.posts.comment.path, isAuthenticated, async (req, res) => {
    const postId = Number(req.params.id);
    const userId = (req.user as any).claims.sub;
    const { content } = req.body;
    
    if (!content) return res.status(400).json({ message: "Content required" });

    const comment = await storage.createComment(postId, userId, content);
    res.status(201).json(comment);
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
    const book = await storage.createBook(req.body);
    res.status(201).json(book);
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
    const userId = (req.user as any).claims.sub;
    const history = await storage.getHistory(userId);
    res.json(history);
  });

  app.post("/api/history", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const entry = await storage.createHistory({ ...req.body, userId });
    res.status(201).json(entry);
  });

  // ── Update own profile ────────────────────────────────────────────────────
  app.patch("/api/profile", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const { firstName, lastName, profileImageUrl } = req.body;
    const existing = await authStorage.getUser(userId);
    if (!existing) return res.status(404).json({ message: "User not found" });
    const updated = await authStorage.upsertUser({
      ...existing,
      firstName: firstName ?? existing.firstName,
      lastName: lastName ?? existing.lastName,
      profileImageUrl: profileImageUrl ?? existing.profileImageUrl,
    });
    res.json(updated);
  });

  // ── Users list (for new chat) ─────────────────────────────────────────────
  app.get("/api/users", isAuthenticated, async (req, res) => {
    const allUsers = await db.select().from(users);
    const me = (req.user as any).claims.sub;
    res.json(allUsers.filter(u => u.id !== me));
  });

  // ── Online status ─────────────────────────────────────────────────────────
  app.post("/api/status/online", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    await storage.setOnlineStatus(userId, true);
    res.json({ ok: true });
  });

  app.post("/api/status/offline", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    await storage.setOnlineStatus(userId, false);
    res.json({ ok: true });
  });

  app.get("/api/status/:userId", isAuthenticated, async (req, res) => {
    const status = await storage.getOnlineStatus(req.params.userId as string);
    res.json(status);
  });

  // ── Direct chats ──────────────────────────────────────────────────────────
  app.get("/api/direct-chats", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
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
    const userId = (req.user as any).claims.sub;
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
    const userId = (req.user as any).claims.sub;
    const chatId = Number(req.params.id);
    const { content, type, mediaUrl, metadata, replyToId, expiresInSeconds } = req.body;
    const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : undefined;
    const msg = await storage.sendDirectMessage({
      chatId, senderId: userId, content, type: type || "text",
      mediaUrl, metadata, replyToId,
      ...(expiresAt ? { expiresAt } : {}),
    });
    res.status(201).json(msg);
  });

  app.patch("/api/direct-chats/:id/read", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    await storage.markMessagesRead(Number(req.params.id), userId);
    res.json({ ok: true });
  });

  app.patch("/api/messages/:id/react", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
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
    const userId = (req.user as any).claims.sub;
    await storage.setTyping(userId, Number(req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/direct-chats/:id/typing", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
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
    const userId = (req.user as any).claims.sub;
    const groups = await storage.getGroupChats(userId);
    res.json(groups);
  });

  app.post("/api/group-chats", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const { name, memberIds } = req.body;
    if (!name) return res.status(400).json({ message: "name required" });
    const group = await storage.createGroupChat({ name, createdBy: userId }, [userId, ...(memberIds || [])]);
    res.status(201).json(group);
  });

  return httpServer;
}
