import express from 'express';
import { db } from '../db';
import { messages, users } from '../../shared/schema';
import { eq, or, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { canSendDM } from '../middleware/privacy';
import { encryptMessage, decryptMessage, generateEncryptionKey } from '../utils/encryption';

const router = express.Router();

// Get messages between current user and another user
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const otherUserId = req.params.userId;

    // Check if users can message each other
    const [currentUser, otherUser] = await Promise.all([
      db.select().from(users).where(eq(users.id, currentUserId)).limit(1),
      db.select().from(users).where(eq(users.id, otherUserId)).limit(1)
    ]);

    if (!currentUser[0] || !otherUser[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check blocking
    if (currentUser[0].blockedUsers?.includes(otherUserId) ||
        otherUser[0].blockedUsers?.includes(currentUserId)) {
      return res.status(403).json({ error: 'Cannot access messages with this user' });
    }

    // Get messages
    const userMessages = await db.select()
      .from(messages)
      .where(
        or(
          and(eq(messages.senderId, currentUserId), eq(messages.receiverId, otherUserId)),
          and(eq(messages.senderId, otherUserId), eq(messages.receiverId, currentUserId))
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(50);

    // Decrypt messages if needed
    const decryptedMessages = userMessages.map(msg => {
      let content = msg.content;
      if (msg.encryptedContent && msg.encryptionKey) {
        try {
          content = decryptMessage(msg.encryptedContent, msg.encryptionKey);
        } catch (error) {
          console.error('Failed to decrypt message:', error);
          content = '[Encrypted message - decryption failed]';
        }
      }

      return {
        ...msg,
        content,
        encryptedContent: undefined, // Don't send encrypted content
        encryptionKey: undefined, // Don't send key
      };
    });

    res.json(decryptedMessages.reverse()); // Reverse to show oldest first
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a message
router.post('/:userId', authMiddleware, canSendDM, async (req, res) => {
  try {
    const senderId = req.session.userId;
    const receiverId = req.params.userId;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const receiverUser = (req as any).receiverUser;

    let encryptedContent: string | undefined;
    let encryptionKey: string | undefined;

    // Encrypt message if receiver has encryption enabled
    if (receiverUser.encryptMessages) {
      encryptionKey = generateEncryptionKey();
      encryptedContent = encryptMessage(content, encryptionKey);
    }

    // Insert message
    const [newMessage] = await db.insert(messages).values({
      senderId,
      receiverId,
      content: receiverUser.encryptMessages ? '[Encrypted]' : content,
      encryptedContent,
      encryptionKey,
    }).returning();

    // Return the message (decrypted for sender)
    const responseMessage = {
      ...newMessage,
      content: receiverUser.encryptMessages ? content : newMessage.content,
      encryptedContent: undefined,
      encryptionKey: undefined,
    };

    res.json(responseMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark messages as read
router.put('/:userId/read', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const otherUserId = req.params.userId;

    await db.update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(messages.senderId, otherUserId),
          eq(messages.receiverId, currentUserId),
          eq(messages.isRead, false)
        )
      );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a message
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const userId = req.session.userId;
    const messageId = parseInt(req.params.messageId);

    // Only allow sender to delete their own messages
    const [message] = await db.select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ error: 'Can only delete your own messages' });
    }

    await db.delete(messages).where(eq(messages.id, messageId));

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;