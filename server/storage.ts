import { 
  posts, comments, likes, books,
  type Post, type InsertPost, type InsertComment, type InsertLike, 
  type Comment, type Like, type Book, type InsertBook 
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Posts
  createPost(post: InsertPost): Promise<Post>;
  getAllPosts(): Promise<Post[]>;
  getPost(id: number): Promise<Post | undefined>;
  
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

  async createComment(postId: number, userId: string, content: string): Promise<Comment> {
    const [comment] = await db.insert(comments).values({
      postId,
      userId,
      content
    }).returning();
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
    if (type) {
      return db.select().from(books).where(eq(books.type, type)).orderBy(desc(books.createdAt));
    }
    return db.select().from(books).orderBy(desc(books.createdAt));
  }
}

export const storage = new DatabaseStorage();
