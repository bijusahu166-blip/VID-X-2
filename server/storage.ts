import { 
  posts, comments, likes, books, ads, history, reports, blocks,
  type Post, type InsertPost, type InsertComment, type InsertLike, 
  type Comment, type Like, type Book, type InsertBook, type Ad, type InsertAd,
  type History, type InsertHistory
} from "@shared/schema";
import {
  directChats, directMessages, groupChats, groupMembers, typingIndicators, userOnlineStatus,
  type DirectChat, type InsertDirectChat, type DirectMessage, type InsertDirectMessage,
  type GroupChat, type InsertGroupChat, type GroupMember
} from "@shared/models/chat";
import { db } from "./db";
import { eq, desc, sql, and, or } from "drizzle-orm";

export interface IStorage {
  // Posts
  createPost(post: InsertPost): Promise<Post>;
  getAllPosts(): Promise<Post[]>;
  getPost(id: number): Promise<Post | undefined>;
  deletePost(id: number, userId: string): Promise<boolean>;
  reportPost(postId: number, reporterId: string, reason: string): Promise<void>;
  
  // Comments
  createComment(postId: number, userId: string, content: string): Promise<Comment>;
  getComments(postId: number): Promise<Comment[]>;

  // Likes
  toggleLike(postId: number, userId: string): Promise<{ added: boolean, count: number }>;
  getLikesCount(postId: number): Promise<number>;
  hasLiked(postId: number, userId: string): Promise<boolean>;

  // Books
  createBook(book: InsertBook): Promise<Book>;
  getBooks(type?: string): Promise<Book[]>;

  // Ads
  getAdsByPlacement(placement: string): Promise<Ad[]>;
  createAd(ad: InsertAd): Promise<Ad>;
  
  // History
  createHistory(entry: InsertHistory): Promise<History>;
  getHistory(userId: string): Promise<History[]>;

  // Blocks
  blockUser(blockerId: string, blockedId: string): Promise<void>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  isBlocked(blockerId: string, blockedId: string): Promise<boolean>;
  getBlockedUsers(userId: string): Promise<string[]>;

  // Direct Chats
  getOrCreateDirectChat(user1Id: string, user2Id: string): Promise<DirectChat>;
  getDirectChats(userId: string): Promise<DirectChat[]>;
  updateChatTheme(chatId: number, theme: string): Promise<void>;

  // Direct Messages
  getDirectMessages(chatId: number): Promise<DirectMessage[]>;
  sendDirectMessage(msg: InsertDirectMessage): Promise<DirectMessage>;
  markMessagesRead(chatId: number, userId: string): Promise<void>;
  addReaction(messageId: number, userId: string, emoji: string): Promise<DirectMessage>;
  pinMessage(messageId: number, pinned: boolean): Promise<DirectMessage>;
  deleteMessage(messageId: number): Promise<void>;

  // Typing & Online Status
  setTyping(userId: string, chatId: number): Promise<void>;
  getTyping(chatId: number, exceptUserId: string): Promise<string[]>;
  setOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  getOnlineStatus(userId: string): Promise<{ isOnline: boolean; lastSeen: Date | null }>;

  // Groups
  createGroupChat(group: InsertGroupChat, memberIds: string[]): Promise<GroupChat>;
  getGroupChats(userId: string): Promise<GroupChat[]>;
  getGroupMembers(groupId: number): Promise<GroupMember[]>;
}

export class DatabaseStorage implements IStorage {
  async createPost(post: InsertPost): Promise<Post> {
    const [newPost] = await db.insert(posts).values(post).returning();
    return newPost;
  }

  async getAllPosts(): Promise<Post[]> {
    return db.select().from(posts).orderBy(desc(posts.createdAt));
  }

  async getPost(id: number): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post;
  }

  async deletePost(id: number, userId: string): Promise<boolean> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    if (!post || post.userId !== userId) return false;
    // Delete related comments and likes first
    await db.delete(comments).where(eq(comments.postId, id));
    await db.delete(likes).where(eq(likes.postId, id));
    await db.delete(reports).where(eq(reports.reportedPostId, id));
    await db.delete(posts).where(eq(posts.id, id));
    return true;
  }

  async reportPost(postId: number, reporterId: string, reason: string): Promise<void> {
    await db.insert(reports).values({ reportedPostId: postId, reporterId, reason });
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    await db.execute(sql`INSERT INTO blocks (blocker_id, blocked_id) VALUES (${blockerId}, ${blockedId}) ON CONFLICT DO NOTHING`);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await db.execute(sql`DELETE FROM blocks WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}`);
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const result = await db.execute(sql`SELECT 1 FROM blocks WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId} LIMIT 1`);
    return (result.rows?.length ?? 0) > 0;
  }

  async getBlockedUsers(userId: string): Promise<string[]> {
    const result = await db.execute(sql`SELECT blocked_id FROM blocks WHERE blocker_id = ${userId}`);
    return (result.rows ?? []).map((r: any) => r.blocked_id);
  }

  async createComment(postId: number, userId: string, content: string): Promise<Comment> {
    const [comment] = await db.insert(comments).values({ postId, userId, content }).returning();
    return comment;
  }

  async getComments(postId: number): Promise<Comment[]> {
    return db.select().from(comments).where(eq(comments.postId, postId)).orderBy(desc(comments.createdAt));
  }

  async toggleLike(postId: number, userId: string): Promise<{ added: boolean, count: number }> {
    const existing = await db.select().from(likes).where(
      sql`${likes.postId} = ${postId} AND ${likes.userId} = ${userId}`
    );
    let added = false;
    if (existing.length > 0) {
      await db.delete(likes).where(sql`${likes.id} = ${existing[0].id}`);
    } else {
      await db.insert(likes).values({ postId, userId });
      added = true;
    }
    const count = await this.getLikesCount(postId);
    return { added, count };
  }

  async getLikesCount(postId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(likes).where(eq(likes.postId, postId));
    return Number(result[0]?.count || 0);
  }

  async hasLiked(postId: number, userId: string): Promise<boolean> {
    const result = await db.select().from(likes).where(
      sql`${likes.postId} = ${postId} AND ${likes.userId} = ${userId}`
    );
    return result.length > 0;
  }

  async createBook(book: InsertBook): Promise<Book> {
    const [newBook] = await db.insert(books).values(book).returning();
    return newBook;
  }

  async getBooks(type?: string): Promise<Book[]> {
    if (type) return db.select().from(books).where(eq(books.type, type)).orderBy(desc(books.createdAt));
    return db.select().from(books).orderBy(desc(books.createdAt));
  }

  async getAdsByPlacement(placement: string): Promise<Ad[]> {
    return db.select().from(ads).where(eq(ads.placement, placement));
  }

  async createAd(ad: InsertAd): Promise<Ad> {
    const [newAd] = await db.insert(ads).values(ad).returning();
    return newAd;
  }

  async createHistory(entry: InsertHistory): Promise<History> {
    const [newEntry] = await db.insert(history).values(entry).returning();
    return newEntry;
  }

  async getHistory(userId: string): Promise<History[]> {
    return db.select().from(history).where(eq(history.userId, userId)).orderBy(desc(history.createdAt)).limit(50);
  }

  // ── Direct Chats ──────────────────────────────────────────────────────────
  async getOrCreateDirectChat(user1Id: string, user2Id: string): Promise<DirectChat> {
    const existing = await db.select().from(directChats).where(
      or(
        and(eq(directChats.user1Id, user1Id), eq(directChats.user2Id, user2Id)),
        and(eq(directChats.user1Id, user2Id), eq(directChats.user2Id, user1Id))
      )
    );
    if (existing.length > 0) return existing[0];
    const [chat] = await db.insert(directChats).values({ user1Id, user2Id }).returning();
    return chat;
  }

  async getDirectChats(userId: string): Promise<DirectChat[]> {
    return db.select().from(directChats).where(
      or(eq(directChats.user1Id, userId), eq(directChats.user2Id, userId))
    ).orderBy(desc(directChats.lastMessageAt));
  }

  async updateChatTheme(chatId: number, theme: string): Promise<void> {
    await db.update(directChats).set({ theme }).where(eq(directChats.id, chatId));
  }

  // ── Direct Messages ───────────────────────────────────────────────────────
  async getDirectMessages(chatId: number): Promise<DirectMessage[]> {
    return db.select().from(directMessages)
      .where(eq(directMessages.chatId, chatId))
      .orderBy(directMessages.createdAt);
  }

  async sendDirectMessage(msg: InsertDirectMessage): Promise<DirectMessage> {
    const [newMsg] = await db.insert(directMessages).values(msg).returning();
    await db.update(directChats).set({ lastMessageAt: new Date() }).where(eq(directChats.id, msg.chatId));
    return newMsg;
  }

  async markMessagesRead(chatId: number, userId: string): Promise<void> {
    await db.update(directMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(directMessages.chatId, chatId),
          sql`${directMessages.senderId} != ${userId}`,
          sql`${directMessages.readAt} IS NULL`
        )
      );
  }

  async addReaction(messageId: number, userId: string, emoji: string): Promise<DirectMessage> {
    const [msg] = await db.select().from(directMessages).where(eq(directMessages.id, messageId));
    if (!msg) throw new Error("Message not found");
    const reactions = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(userId);
    if (idx >= 0) {
      reactions[emoji].splice(idx, 1);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji].push(userId);
    }
    const [updated] = await db.update(directMessages)
      .set({ reactions: JSON.stringify(reactions) })
      .where(eq(directMessages.id, messageId))
      .returning();
    return updated;
  }

  async pinMessage(messageId: number, pinned: boolean): Promise<DirectMessage> {
    const [updated] = await db.update(directMessages)
      .set({ pinnedAt: pinned ? new Date() : null })
      .where(eq(directMessages.id, messageId))
      .returning();
    return updated;
  }

  async deleteMessage(messageId: number): Promise<void> {
    await db.delete(directMessages).where(eq(directMessages.id, messageId));
  }

  // ── Typing Indicators ─────────────────────────────────────────────────────
  async setTyping(userId: string, chatId: number): Promise<void> {
    await db.insert(typingIndicators)
      .values({ userId, chatId, updatedAt: new Date() })
      .onConflictDoUpdate({ target: typingIndicators.userId, set: { chatId, updatedAt: new Date() } });
  }

  async getTyping(chatId: number, exceptUserId: string): Promise<string[]> {
    const cutoff = new Date(Date.now() - 4000);
    const rows = await db.select().from(typingIndicators).where(
      and(
        eq(typingIndicators.chatId, chatId),
        sql`${typingIndicators.userId} != ${exceptUserId}`,
        sql`${typingIndicators.updatedAt} > ${cutoff}`
      )
    );
    return rows.map(r => r.userId);
  }

  // ── Online Status ─────────────────────────────────────────────────────────
  async setOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await db.insert(userOnlineStatus)
      .values({ userId, isOnline, lastSeen: new Date() })
      .onConflictDoUpdate({ target: userOnlineStatus.userId, set: { isOnline, lastSeen: new Date() } });
  }

  async getOnlineStatus(userId: string): Promise<{ isOnline: boolean; lastSeen: Date | null }> {
    const [row] = await db.select().from(userOnlineStatus).where(eq(userOnlineStatus.userId, userId));
    return { isOnline: row?.isOnline ?? false, lastSeen: row?.lastSeen ?? null };
  }

  // ── Groups ────────────────────────────────────────────────────────────────
  async createGroupChat(group: InsertGroupChat, memberIds: string[]): Promise<GroupChat> {
    const [newGroup] = await db.insert(groupChats).values(group).returning();
    if (memberIds.length > 0) {
      await db.insert(groupMembers).values(memberIds.map(uid => ({ groupId: newGroup.id, userId: uid })));
    }
    return newGroup;
  }

  async getGroupChats(userId: string): Promise<GroupChat[]> {
    const memberRows = await db.select().from(groupMembers).where(eq(groupMembers.userId, userId));
    const groupIds = memberRows.map(r => r.groupId);
    if (groupIds.length === 0) return [];
    return db.select().from(groupChats).where(sql`${groupChats.id} = ANY(${groupIds})`);
  }

  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    return db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
  }
}

export const storage = new DatabaseStorage();
