import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ── AI Chat (existing) ──────────────────────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// ── Direct Chats ────────────────────────────────────────────────────────────
export const directChats = pgTable("direct_chats", {
  id: serial("id").primaryKey(),
  user1Id: text("user1_id").notNull(),
  user2Id: text("user2_id").notNull(),
  theme: text("theme").default("default"),
  e2eEnabled: boolean("e2e_enabled").default(true),
  lastMessageAt: timestamp("last_message_at").default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Direct Messages ─────────────────────────────────────────────────────────
export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => directChats.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull(),
  content: text("content"),
  type: text("type").default("text"), // text | image | video | voice | poll | location | file
  mediaUrl: text("media_url"),
  metadata: text("metadata"), // JSON: poll options, location coords, etc.
  readAt: timestamp("read_at"),
  pinnedAt: timestamp("pinned_at"),
  expiresAt: timestamp("expires_at"),
  reactions: text("reactions").default("{}"), // JSON: {emoji: userId[]}
  replyToId: integer("reply_to_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Group Chats ─────────────────────────────────────────────────────────────
export const groupChats = pgTable("group_chats", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdBy: text("created_by").notNull(),
  theme: text("theme").default("default"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupChats.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role").default("member"),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Typing Indicators ───────────────────────────────────────────────────────
export const typingIndicators = pgTable("typing_indicators", {
  userId: text("user_id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ── Online Status ───────────────────────────────────────────────────────────
export const userOnlineStatus = pgTable("user_online_status", {
  userId: text("user_id").primaryKey(),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen").default(sql`CURRENT_TIMESTAMP`),
});

// ── Insert schemas & types ───────────────────────────────────────────────────
export const insertDirectChatSchema = createInsertSchema(directChats).omit({ id: true, createdAt: true });
export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({ id: true, createdAt: true });
export const insertGroupChatSchema = createInsertSchema(groupChats).omit({ id: true, createdAt: true });
export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({ id: true, joinedAt: true });

export type DirectChat = typeof directChats.$inferSelect;
export type InsertDirectChat = z.infer<typeof insertDirectChatSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type GroupChat = typeof groupChats.$inferSelect;
export type InsertGroupChat = z.infer<typeof insertGroupChatSchema>;
export type GroupMember = typeof groupMembers.$inferSelect;
