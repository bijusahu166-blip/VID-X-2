import express from "express";
import { db } from "../db";
import { messages, users } from "../../shared/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { canSendDM } from "../middleware/privacy";
import {
  encryptMessage,
  decryptMessage,
  generateEncryptionKey,
} from "../utils/encryption";

const router = express.Router();

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getSessionUserId(req: express.Request): string {
  return String((req.session as any)?.userId ?? "");
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

// Get messages between current user and another user
router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    const currentUserId = getSessionUserId(req);
    const otherUserId = getParam(req.params.userId);

    if (!currentUserId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!otherUserId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const [currentUserRows, otherUserRows] = await Promise.all([
      db.select().from(users).where(eq(users.id, currentUserId)).limit(1),
      db.select().from(users).where(eq(users.id, otherUserId)).limit(1),
    ]);

    const currentUser = currentUserRows[0];
    const otherUser = otherUserRows[0];

    if (!currentUser || !otherUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentBlocked = normalizeStringArray((currentUser as any).blockedUsers);
    const otherBlocked = normalizeStringArray((otherUser as any).blockedUsers);

    if (
      currentBlocked.includes(otherUserId) ||
      otherBlocked.includes(currentUserId)
    ) {
      return res
        .status(403)
        .json({ error: "Cannot access messages with this user" });
    }

    const userMessages = await db
      .select()
      .from(messages)
      .where(
        or(
          and(
            eq(messages.senderId, currentUserId),
            eq(messages.receiverId, otherUserId)
          ),
          and(
            eq(messages.senderId, otherUserId),
            eq(messages.receiverId, currentUserId)
          )
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(50);

    const decryptedMessages = userMessages.map((msg) => {
      let content = msg.content;

      if (msg.encryptedContent && msg.encryptionKey) {
        try {
          content = decryptMessage(msg.encryptedContent, msg.encryptionKey);
        } catch (error) {
          console.error("Failed to decrypt message:", error);
          content = "[Encrypted message - decryption failed]";
        }
      }

      return {
        ...msg,
        content,
        encryptedContent: undefined,
        encryptionKey: undefined,
      };
    });

    return res.json(decryptedMessages.reverse());
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Send a message
router.post("/:userId", authMiddleware, canSendDM, async (req, res) => {
  try {
    const senderId = getSessionUserId(req);
    const receiverId = getParam(req.params.userId);
    const content = String(req.body?.content ?? "");

    if (!senderId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!receiverId) {
      return res.status(400).json({ error: "Receiver ID is required" });
    }
    if (!content.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    const receiverUser = (req as any).receiverUser;
    if (!receiverUser) {
      return res.status(403).json({ error: "Cannot send message to this user" });
    }

    if (String(receiverUser.id) !== receiverId) {
      return res.status(400).json({ error: "Receiver ID mismatch" });
    }

    let encryptedContent: string | null = null;
    let encryptionKey: string | null = null;

    if (receiverUser.encryptMessages) {
      try {
        encryptionKey = generateEncryptionKey();
        encryptedContent = encryptMessage(content, encryptionKey);
      } catch (encryptError) {
        console.error("Encryption failed:", encryptError);
        return res.status(500).json({ error: "Failed to encrypt message" });
      }
    }

    try {
      const [newMessage] = await db
        .insert(messages)
        .values({
          senderId,
          receiverId,
          content: receiverUser.encryptMessages ? "[Encrypted]" : content.trim(),
          encryptedContent,
          encryptionKey,
        })
        .returning();

      if (!newMessage) {
        return res.status(500).json({ error: "Failed to create message" });
      }

      return res.status(201).json({
        ...newMessage,
        content: receiverUser.encryptMessages ? content.trim() : newMessage.content,
        encryptedContent: undefined,
        encryptionKey: undefined,
      });
    } catch (dbError: any) {
      console.error("Database error on message insert:", dbError);

      if (dbError?.code === "23503") {
        return res.status(400).json({ error: "Invalid receiver ID" });
      }
      if (dbError?.code === "23505") {
        return res.status(409).json({ error: "Message already exists" });
      }
      if (dbError?.code === "40P01") {
        return res.status(503).json({ error: "Server busy, please retry" });
      }

      throw dbError;
    }
  } catch (error: any) {
    console.error("Send message error:", error);
    return res.status(500).json({
      error: "Failed to send message",
      ...(process.env.NODE_ENV === "development" && {
        debug: error?.message,
      }),
    });
  }
});

// Mark messages as read
router.put("/:userId/read", authMiddleware, async (req, res) => {
  try {
    const currentUserId = getSessionUserId(req);
    const otherUserId = getParam(req.params.userId);

    if (!currentUserId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!otherUserId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    await db
      .update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(messages.senderId, otherUserId),
          eq(messages.receiverId, currentUserId),
          eq(messages.isRead, false)
        )
      );

    return res.json({ message: "Messages marked as read" });
  } catch (error) {
    console.error("Mark read error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete ONE message. Only the sender can delete their sent message.
router.delete("/:messageId", authMiddleware, async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const rawMessageId = getParam(req.params.messageId);
    const messageId = Number(rawMessageId);

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!Number.isInteger(messageId) || messageId <= 0) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId !== userId) {
      return res
        .status(403)
        .json({ error: "Cannot delete other users' messages" });
    }

    await db
      .delete(messages)
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.senderId, userId)
        )
      );

    return res.json({
      success: true,
      messageId,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Delete message error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete the entire direct-message history between current user and another user.
// This removes only rows involving the logged-in user and the selected user.
router.delete("/conversation/:userId/all", authMiddleware, async (req, res) => {
  try {
    const currentUserId = getSessionUserId(req);
    const otherUserId = getParam(req.params.userId);

    if (!currentUserId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!otherUserId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    await db
      .delete(messages)
      .where(
        or(
          and(
            eq(messages.senderId, currentUserId),
            eq(messages.receiverId, otherUserId)
          ),
          and(
            eq(messages.senderId, otherUserId),
            eq(messages.receiverId, currentUserId)
          )
        )
      );

    return res.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
