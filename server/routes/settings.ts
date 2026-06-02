import express from 'express';
import { db } from '../db';
import { users, reports } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'vidx445@gmail.com';
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || '824906692';

const router = express.Router();

// Get user settings
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.session.userId;

    const [user] = await db.select({
      // Privacy settings
      isPrivate: users.isPrivate,
      allowMessages: users.allowMessages,
      allowComments: users.allowComments,
      allowLikes: users.allowLikes,
      allowShares: users.allowShares,
      allowStoryViews: users.allowStoryViews,
      allowProfileViews: users.allowProfileViews,
      allowTagging: users.allowTagging,
      showOnlineStatus: users.showOnlineStatus,
      showLastSeen: users.showLastSeen,
      showReadReceipts: users.showReadReceipts,
      encryptMessages: users.encryptMessages,

      // Content visibility
      contentVisibility: users.contentVisibility,
      storyVisibility: users.storyVisibility,
      messagePrivacy: users.messagePrivacy,

      // Security
      twoFactorEnabled: users.twoFactorEnabled,

      // Social
      blockedUsers: users.blockedUsers,
      mutedUsers: users.mutedUsers,
      closeFriends: users.closeFriends,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      ...user,
      officialEmail: SUPPORT_EMAIL,
      officialPhone: SUPPORT_PHONE,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user settings
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.session.userId;
    const updates = req.body;

    // Validate allowed fields
    const allowedFields = [
      'isPrivate', 'allowMessages', 'allowComments', 'allowLikes', 'allowShares',
      'allowStoryViews', 'allowProfileViews', 'allowTagging', 'showOnlineStatus',
      'showLastSeen', 'showReadReceipts', 'encryptMessages', 'contentVisibility',
      'storyVisibility', 'messagePrivacy', 'blockedUsers', 'mutedUsers', 'closeFriends'
    ];

    const filteredUpdates: any = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Update user settings
    await db.update(users)
      .set({ ...filteredUpdates, updatedAt: new Date() })
      .where(eq(users.id, userId));

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Block a user
router.post('/block/:userId', authMiddleware, async (req, res) => {
  try {
    const blockerId = req.session.userId;
    const blockedId = req.params.userId;

    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Get current blocked users
    const [user] = await db.select({ blockedUsers: users.blockedUsers })
      .from(users)
      .where(eq(users.id, blockerId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const blockedUsers = user.blockedUsers || [];
    if (blockedUsers.includes(blockedId)) {
      return res.status(400).json({ error: 'User already blocked' });
    }

    // Add to blocked users
    blockedUsers.push(blockedId);

    await db.update(users)
      .set({ blockedUsers, updatedAt: new Date() })
      .where(eq(users.id, blockerId));

    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unblock a user
router.delete('/block/:userId', authMiddleware, async (req, res) => {
  try {
    const blockerId = req.session.userId;
    const blockedId = req.params.userId;

    // Get current blocked users
    const [user] = await db.select({ blockedUsers: users.blockedUsers })
      .from(users)
      .where(eq(users.id, blockerId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const blockedUsers = user.blockedUsers || [];
    const index = blockedUsers.indexOf(blockedId);

    if (index === -1) {
      return res.status(400).json({ error: 'User not blocked' });
    }

    // Remove from blocked users
    blockedUsers.splice(index, 1);

    await db.update(users)
      .set({ blockedUsers, updatedAt: new Date() })
      .where(eq(users.id, blockerId));

    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Report a user/post/comment
router.post('/report', authMiddleware, async (req, res) => {
  try {
    const { reportedUserId, reportedPostId, reportedCommentId, reason, description } = req.body;
    const reporterId = req.session.userId;

    if (!reason) {
      return res.status(400).json({ error: 'Report reason is required' });
    }

    if (!reportedUserId && !reportedPostId && !reportedCommentId) {
      return res.status(400).json({ error: 'Must report a user, post, or comment' });
    }

    // Insert report
    await db.insert(reports).values({
      reporterId,
      reportedUserId,
      reportedPostId,
      reportedCommentId,
      reason,
      description,
    });

    res.json({ message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;