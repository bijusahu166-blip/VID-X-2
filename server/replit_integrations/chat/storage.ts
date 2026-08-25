import { db } from "../../db";
import { conversations, conversationMessages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IChatStorage {
  getConversation(
    id: number
  ): Promise<typeof conversations.$inferSelect | undefined>;

  getAllConversations(): Promise<
    (typeof conversations.$inferSelect)[]
  >;

  createConversation(
    title: string
  ): Promise<typeof conversations.$inferSelect>;

  deleteConversation(id: number): Promise<void>;

  getMessagesByConversation(
    conversationId: number
  ): Promise<(typeof conversationMessages.$inferSelect)[]>;

  createMessage(
    conversationId: number,
    role: string,
    content: string
  ): Promise<typeof conversationMessages.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    return conversation;
  },

  async getAllConversations() {
    return db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt));
  },

  async createConversation(title: string) {
    const cleanTitle = title.trim() || "New conversation";

    const [conversation] = await db
      .insert(conversations)
      .values({ title: cleanTitle })
      .returning();

    if (!conversation) {
      throw new Error("Failed to create conversation");
    }

    return conversation;
  },

  async deleteConversation(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Invalid conversation ID");
    }

    // conversation_messages already has ON DELETE CASCADE in schema,
    // but deleting child rows first also works with older DB schemas.
    await db
      .delete(conversationMessages)
      .where(eq(conversationMessages.conversationId, id));

    await db
      .delete(conversations)
      .where(eq(conversations.id, id));
  },

  async getMessagesByConversation(conversationId: number) {
    return db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.createdAt);
  },

  async createMessage(
    conversationId: number,
    role: string,
    content: string
  ) {
    const [message] = await db
      .insert(conversationMessages)
      .values({
        conversationId,
        role: role.trim(),
        content,
      })
      .returning();

    if (!message) {
      throw new Error("Failed to create chat message");
    }

    return message;
  },
};
