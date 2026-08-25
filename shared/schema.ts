import { pgTable, text, serial, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";
import { relations, sql } from "drizzle-orm";

// IMPORTANT: Users ko sabse pehle export karo
export { users };

// 0. SESSIONS TABLE (Login fix karne ke liye)
export const sessions = pgTable("sessions", {
  sid: text("sid").primaryKey(), 
  sess: text("sess").notNull(),  
  expire: timestamp("expire").notNull(), 
});

// 1. POSTS, REELS & CONTENT
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // No direct reference here to avoid circular error during push
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  type: text("type").default("post"), 
  videoUrl: text("video_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  liveEndedAt: timestamp("live_ended_at"),
  viewerCount: integer("viewer_count").default(0),
  songTitle: text("song_title"),
  songArtist: text("song_artist"),
  songColor: text("song_color"),
},
(table) => [
  index("IDX_posts_user_id").on(table.userId),
  index("IDX_posts_created_at").on(table.createdAt),
  index("IDX_posts_type").on(table.type),
  index("IDX_posts_viewer_count").on(table.viewerCount),
  index("IDX_posts_user_created").on(table.userId, table.createdAt),
]);

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_comments_post_id").on(table.postId),
  index("IDX_comments_user_id").on(table.userId),
  index("IDX_comments_created_at").on(table.createdAt),
]);

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  reportedUserId: text("reported_user_id"),
  reportedPostId: integer("reported_post_id"),
  reportedCommentId: integer("reported_comment_id"),
  reason: text("reason").notNull(), // "spam", "harassment", "inappropriate", "copyright", "other"
  description: text("description"),
  status: text("status").default("pending"), // "pending", "investigating", "resolved", "dismissed"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
},
(table) => [
  index("IDX_reports_reporter_id").on(table.reporterId),
  index("IDX_reports_reported_user_id").on(table.reportedUserId),
  index("IDX_reports_reported_post_id").on(table.reportedPostId),
  index("IDX_reports_status").on(table.status),
  index("IDX_reports_created_at").on(table.createdAt),
]);

export const pendingBlocks = pgTable("pending_blocks", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: 'cascade' }),
  reportedUserId: text("reported_user_id").notNull(),
  blockedUserId: text("blocked_user_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  blockUntil: timestamp("block_until").notNull(),
},
(table) => [
  index("IDX_pending_blocks_reported_user").on(table.reportedUserId),
  index("IDX_pending_blocks_blocked_user").on(table.blockedUserId),
  index("IDX_pending_blocks_block_until").on(table.blockUntil),
  index("IDX_pending_blocks_post_blocked").on(table.postId, table.blockedUserId),
]);

export const blocks = pgTable("blocks", {
  id: serial("id").primaryKey(),
  blockerId: text("blocker_id").notNull(),
  blockedId: text("blocked_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_blocks_blocker_id").on(table.blockerId),
  index("IDX_blocks_blocked_id").on(table.blockedId),
  uniqueIndex("IDX_blocks_blocker_blocked").on(table.blockerId, table.blockedId),
]);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  receiverId: text("receiver_id").notNull(),
  content: text("content").notNull(),
  encryptedContent: text("encrypted_content"), // For encrypted messages
  encryptionKey: text("encryption_key"), // One-time key for decryption
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_messages_sender_id").on(table.senderId),
  index("IDX_messages_receiver_id").on(table.receiverId),
  index("IDX_messages_sender_receiver").on(table.senderId, table.receiverId),
  index("IDX_messages_created_at").on(table.createdAt),
  index("IDX_messages_is_read").on(table.isRead),
]);

export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: text("user_id").notNull(),
},
(table) => [
  index("IDX_likes_post_id").on(table.postId),
  index("IDX_likes_user_id").on(table.userId),
  index("IDX_likes_post_user").on(table.postId, table.userId),
]);

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: text("follower_id").notNull(),
  followingId: text("following_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_follows_follower_id").on(table.followerId),
  index("IDX_follows_following_id").on(table.followingId),
  index("IDX_follows_follower_following").on(table.followerId, table.followingId),
]);

export const savedPosts = pgTable("saved_posts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_saved_posts_user_id").on(table.userId),
  index("IDX_saved_posts_post_id").on(table.postId),
  index("IDX_saved_posts_user_created").on(table.userId, table.createdAt),
]);

export const stories = pgTable("stories", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  mediaUrl: text("media_url").notNull(),
  type: text("type").default("image"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  viewerCount: integer("viewer_count").default(0),
},
(table) => [
  index("IDX_stories_user_id").on(table.userId),
  index("IDX_stories_expires_at").on(table.expiresAt),
  index("IDX_stories_created_at").on(table.createdAt),
  index("IDX_stories_user_created").on(table.userId, table.createdAt),
]);

// 2. AI CHATBOT
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
  index("IDX_conversations_created_at").on(table.createdAt),
]);

export const conversationMessages = pgTable("conversation_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
  index("IDX_conversation_messages_conversation_id").on(table.conversationId),
  index("IDX_conversation_messages_created_at").on(table.createdAt),
  index("IDX_conversation_messages_conv_created").on(table.conversationId, table.createdAt),
]);

// 3. DIRECT & GROUP CHATS
export const directChats = pgTable("direct_chats", {
  id: serial("id").primaryKey(),
  user1Id: text("user1_id").notNull(),
  user2Id: text("user2_id").notNull(),
  theme: text("theme").default("default"),
  e2eEnabled: boolean("e2e_enabled").default(true),
  lastMessageAt: timestamp("last_message_at").default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
  index("IDX_direct_chats_user1").on(table.user1Id),
  index("IDX_direct_chats_user2").on(table.user2Id),
  index("IDX_direct_chats_users").on(table.user1Id, table.user2Id),
]);

export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => directChats.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull(),
  content: text("content"),
  type: text("type").default("text"), 
  mediaUrl: text("media_url"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
  index("IDX_direct_messages_chat_id").on(table.chatId),
  index("IDX_direct_messages_sender_id").on(table.senderId),
  index("IDX_direct_messages_created_at").on(table.createdAt),
  index("IDX_direct_messages_chat_created").on(table.chatId, table.createdAt),
]);

export const groupChats = pgTable("group_chats", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdBy: text("created_by").notNull(),
  theme: text("theme").default("default"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
  index("IDX_group_chats_created_by").on(table.createdBy),
  index("IDX_group_chats_created_at").on(table.createdAt),
]);

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupChats.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role").default("member"),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
  index("IDX_group_members_group_id").on(table.groupId),
  index("IDX_group_members_user_id").on(table.userId),
  index("IDX_group_members_group_user").on(table.groupId, table.userId),
]);

// 4. UTILITIES
export const userOnlineStatus = pgTable("user_online_status", {
  userId: text("user_id").primaryKey(),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen").default(sql`CURRENT_TIMESTAMP`),
});

export const history = pgTable("history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(), 
  targetId: text("target_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_history_user_id").on(table.userId),
  index("IDX_history_created_at").on(table.createdAt),
  index("IDX_history_user_created").on(table.userId, table.createdAt),
]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  fromUserId: text("from_user_id"),
  type: text("type").notNull(),
  message: text("message").notNull(),
  postId: integer("post_id"),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_notifications_user_id").on(table.userId),
  index("IDX_notifications_read").on(table.read),
  index("IDX_notifications_created_at").on(table.createdAt),
  index("IDX_notifications_user_read").on(table.userId, table.read),
  index("IDX_notifications_user_created").on(table.userId, table.createdAt),
]);

// 5. BOOKS & ADS
export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  author: text("author"),
  subject: text("subject"),
  content: text("content").notNull().default(""),
  imageUrl: text("image_url"),
  pdfUrl: text("pdf_url"),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_books_user_id").on(table.userId),
  index("IDX_books_type").on(table.type),
  index("IDX_books_subject").on(table.subject),
  index("IDX_books_created_at").on(table.createdAt),
]);

export const ads = pgTable("ads", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  linkUrl: text("link_url").notNull(),
  type: text("type").notNull(),
  placement: text("placement").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_ads_type").on(table.type),
  index("IDX_ads_placement").on(table.placement),
  index("IDX_ads_created_at").on(table.createdAt),
]);
// ── RESTRICTED ACCOUNTS (BlockShield) ──
export const restrictedAccounts = pgTable("restricted_accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  restrictedUserId: text("restricted_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_restricted_user_id").on(table.userId),
  uniqueIndex("IDX_restricted_pair").on(table.userId, table.restrictedUserId),
]);

// ── HIDDEN WORDS (BlockShield) ──
export const hiddenWords = pgTable("hidden_words", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  word: text("word").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_hidden_words_user_id").on(table.userId),
]);

// ── CLOSE FRIENDS (InnerCircle) ──
export const closeFriends = pgTable("close_friends", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  friendId: text("friend_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_close_friends_user_id").on(table.userId),
  uniqueIndex("IDX_close_friends_pair").on(table.userId, table.friendId),
]);

// ── POST DRAFTS (ProTools Hub) ──
export const postDrafts = pgTable("post_drafts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  caption: text("caption"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  type: text("type").default("post"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_post_drafts_user_id").on(table.userId),
]);

// ── SCHEDULED POSTS (ProTools Hub) ──
export const scheduledPosts = pgTable("scheduled_posts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  caption: text("caption"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  type: text("type").default("post"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").default("pending"), // pending, published, failed, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_scheduled_posts_user_id").on(table.userId),
  index("IDX_scheduled_posts_scheduled_for").on(table.scheduledFor),
  index("IDX_scheduled_posts_status").on(table.status),
]);

// ── PROFILE VIEWS (InsightX analytics) ──
export const profileViews = pgTable("profile_views", {
  id: serial("id").primaryKey(),
  viewerId: text("viewer_id").notNull(),
  viewedUserId: text("viewed_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_profile_views_viewed_user").on(table.viewedUserId),
  index("IDX_profile_views_created_at").on(table.createdAt),
]);

// ── LOGIN SESSIONS (Security → Devices) ──
export const loginSessions = pgTable("login_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  location: text("location"),
  lastActive: timestamp("last_active").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_login_sessions_user_id").on(table.userId),
  index("IDX_login_sessions_last_active").on(table.lastActive),
]);

// ── AD PREFERENCES (Ad Topics / Hide Advertiser) ──
export const adPreferences = pgTable("ad_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // "topic" | "advertiser"
  value: text("value").notNull(),
  hidden: boolean("hidden").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
},
(table) => [
  index("IDX_ad_preferences_user_id").on(table.userId),
]);
// 6. RELATIONS
export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, { fields: [posts.userId], references: [users.id] }),
  comments: many(comments),
  likes: many(likes),
  savedPosts: many(savedPosts),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(conversationMessages),
}));

// 7. SCHEMAS & TYPES
export const insertPostSchema = createInsertSchema(posts).omit({ id: true, createdAt: true });
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(conversationMessages).omit({ id: true, createdAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({ id: true, createdAt: true });

// ── SELECT TYPES ─────────────────────────────────────────────────────────────
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Book = typeof books.$inferSelect;
export type Ad = typeof ads.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof conversationMessages.$inferSelect;
export type History = typeof history.$inferSelect;
export type DirectMessage = typeof directMessages.$inferSelect;
export type DirectChat = typeof directChats.$inferSelect;
export type GroupChat = typeof groupChats.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type SavedPost = typeof savedPosts.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Report = typeof reports.$inferSelect;

// ── INSERT TYPES ─────────────────────────────────────────────────────────────
export type InsertPost = typeof posts.$inferInsert;
export type InsertComment = typeof comments.$inferInsert;
export type InsertLike = typeof likes.$inferInsert;
export type InsertBook = typeof books.$inferInsert;
export type InsertAd = typeof ads.$inferInsert;
export type InsertConversation = typeof conversations.$inferInsert;
export type InsertMessage = typeof conversationMessages.$inferInsert;
export type InsertHistory = typeof history.$inferInsert;
export type InsertDirectMessage = typeof directMessages.$inferInsert;
export type InsertDirectChat = typeof directChats.$inferInsert;
export type InsertGroupChat = typeof groupChats.$inferInsert;
export type InsertGroupMember = typeof groupMembers.$inferInsert;
export type InsertStory = typeof stories.$inferInsert;
export type InsertFollow = typeof follows.$inferInsert;
export type InsertSavedPost = typeof savedPosts.$inferInsert;
export type InsertNotification = typeof notifications.$inferInsert;
export type InsertReport = typeof reports.$inferInsert;