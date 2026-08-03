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

    const [currentUser, otherUser] = await Promise.all([
      db.select().from(users).where(eq(users.id, currentUserId)).limit(1),
      db.select().from(users).where(eq(users.id, otherUserId)).limit(1)
    ]);

    if (!currentUser[0] || !otherUser[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (currentUser[0].blockedUsers?.includes(otherUserId) ||
        otherUser[0].blockedUsers?.includes(currentUserId)) {
      return res.status(403).json({ error: 'Cannot access messages with this user' });
    }

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
        encryptedContent: undefined,
        encryptionKey: undefined,
      };
    });

    res.json(decryptedMessages.reverse());
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

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Validate receiverUser was set by middleware
    const receiverUser = (req as any).receiverUser;
    if (!receiverUser) {
      console.error('receiverUser not set by canSendDM middleware');
      return res.status(403).json({ error: 'Cannot send message to this user' });
    }

    // Validate receiverId matches receiverUser
    if (receiverUser.id !== receiverId) {
      return res.status(400).json({ error: 'Receiver ID mismatch' });
    }

    // Verify receiver exists in DB
    const receiverExists = await db.select()
      .from(users)
      .where(eq(users.id, receiverId))
      .limit(1);

    if (!receiverExists[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    let encryptedContent: string | undefined;
    let encryptionKey: string | undefined;

    if (receiverUser.encryptMessages) {
      try {
        encryptionKey = generateEncryptionKey();
        encryptedContent = encryptMessage(content, encryptionKey);
      } catch (encryptError) {
        console.error('Encryption failed:', encryptError);
        return res.status(500).json({ error: 'Failed to encrypt message' });
      }
    }

    let newMessage;
    try {
      const insertResult = await db.insert(messages).values({
        senderId,
        receiverId,
        content: receiverUser.encryptMessages ? '[Encrypted]' : content,
        encryptedContent,
        encryptionKey,
      }).returning();

      if (!insertResult || insertResult.length === 0) {
        return res.status(500).json({ error: 'Failed to create message' });
      }

      newMessage = insertResult[0];
    } catch (dbError: any) {
      console.error('Database error on message insert:', {
        code: dbError.code,
        message: dbError.message,
        constraint: dbError.constraint,
        detail: dbError.detail
      });

      if (dbError.code === '23503') {
        return res.status(400).json({ error: 'Invalid receiver ID' });
      }
      if (dbError.code === '23505') {
        return res.status(409).json({ error: 'Message already exists' });
      }
      if (dbError.code === '40P01') {
        return res.status(503).json({ error: 'Server busy, please retry' });
      }

      throw dbError;
    }

    const responseMessage = {
      ...newMessage,
      content: receiverUser.encryptMessages ? content : newMessage.content,
      encryptedContent: undefined,
      encryptionKey: undefined,
    };

    res.json(responseMessage);
  } catch (error: any) {
    console.error('Send message error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    res.status(500).json({
      error: 'Failed to send message',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message })
    });
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

    const [message] = await db.select()
      .from(messages)          // ✅ fixed: was directMessages
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ error: 'Cannot delete other users messages' });
    }

    await db.delete(messages).where(eq(messages.id, messageId));   // ✅ fixed: was directMessages

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;