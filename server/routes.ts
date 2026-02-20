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
import { posts, comments } from "@shared/schema";
import { db } from "./db";

async function seed() {
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) return;

  console.log("Seeding database...");

  // Seed users
  const [user1] = await db.insert(users).values({
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Wonder",
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

  return httpServer;
}
