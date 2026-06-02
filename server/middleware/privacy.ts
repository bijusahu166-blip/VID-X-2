import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../../shared/models/auth';
import { eq, or, and } from 'drizzle-orm';

// Check if user can send DM to another user
export const canSendDM = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const senderId = req.session?.userId;
    const receiverId = req.params.userId || req.body.receiverId;

    if (!senderId || !receiverId) {
      return res.status(400).json({ error: 'Sender and receiver required' });
    }

    // Get both users' privacy settings
    const [sender, receiver] = await Promise.all([
      db.select().from(users).where(eq(users.id, senderId)).limit(1),
      db.select().from(users).where(eq(users.id, receiverId)).limit(1)
    ]);

    if (!sender[0] || !receiver[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const senderUser = sender[0];
    const receiverUser = receiver[0];

    // Check if receiver allows messages
    if (!receiverUser.allowMessages) {
      return res.status(403).json({ error: 'This user does not accept messages' });
    }

    // Check message privacy settings
    if (receiverUser.messagePrivacy === 'none') {
      return res.status(403).json({ error: 'This user does not accept messages' });
    }

    // Check if sender is blocked by receiver
    if (receiverUser.blockedUsers?.includes(senderId)) {
      return res.status(403).json({ error: 'You are blocked by this user' });
    }

    // Check if receiver is blocked by sender
    if (senderUser.blockedUsers?.includes(receiverId)) {
      return res.status(403).json({ error: 'You have blocked this user' });
    }

    // Additional privacy checks based on messagePrivacy setting
    if (receiverUser.messagePrivacy === 'followers') {
      // Check if sender follows receiver (simplified - you might want to check follows table)
      // For now, allow if not private account or if sender is following
      if (receiverUser.isPrivate) {
        // TODO: Check if sender follows receiver
        // const isFollowing = await checkFollowRelationship(senderId, receiverId);
        // if (!isFollowing) return res.status(403).json({ error: 'You must follow this user to send messages' });
      }
    }

    if (receiverUser.messagePrivacy === 'following') {
      // Check if receiver follows sender
      // TODO: Implement follow check
    }

    // Store receiver info for later use
    (req as any).receiverUser = receiverUser;
    next();
  } catch (error) {
    console.error('DM permission check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Check if user can view content (posts/videos)
export const canViewContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const viewerId = req.session?.userId;
    const contentOwnerId = req.params.userId || req.body.userId;

    if (!contentOwnerId) {
      return next(); // Public content
    }

    const [owner] = await db.select().from(users).where(eq(users.id, contentOwnerId)).limit(1);

    if (!owner[0]) {
      return res.status(404).json({ error: 'Content owner not found' });
    }

    const ownerUser = owner[0];

    // Check if content is private
    if (ownerUser.contentVisibility === 'private' && viewerId !== contentOwnerId) {
      return res.status(403).json({ error: 'This content is private' });
    }

    // Check if content is friends-only
    if (ownerUser.contentVisibility === 'friends' && viewerId !== contentOwnerId) {
      // TODO: Check if viewer is in owner's close friends or followers
      // For now, assume friends means close friends
      if (!ownerUser.closeFriends?.includes(viewerId)) {
        return res.status(403).json({ error: 'This content is only visible to friends' });
      }
    }

    // Check if viewer is blocked
    if (ownerUser.blockedUsers?.includes(viewerId)) {
      return res.status(403).json({ error: 'You are blocked by this user' });
    }

    (req as any).contentOwner = ownerUser;
    next();
  } catch (error) {
    console.error('Content view permission check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Check if user can comment on content
export const canComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commenterId = req.session?.userId;
    const contentOwnerId = req.params.userId || req.body.userId;

    if (!commenterId || !contentOwnerId) {
      return res.status(400).json({ error: 'Commenter and content owner required' });
    }

    const [owner] = await db.select().from(users).where(eq(users.id, contentOwnerId)).limit(1);

    if (!owner[0]) {
      return res.status(404).json({ error: 'Content owner not found' });
    }

    const ownerUser = owner[0];

    // Check if owner allows comments
    if (!ownerUser.allowComments) {
      return res.status(403).json({ error: 'Comments are disabled for this content' });
    }

    // Check if commenter is blocked
    if (ownerUser.blockedUsers?.includes(commenterId)) {
      return res.status(403).json({ error: 'You are blocked by this user' });
    }

    (req as any).contentOwner = ownerUser;
    next();
  } catch (error) {
    console.error('Comment permission check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};