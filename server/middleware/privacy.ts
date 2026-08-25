import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "../../shared/models/auth";
import { eq } from "drizzle-orm";

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function getSessionUserId(req: Request): string {
  return String((req.session as any)?.userId ?? "");
}

// Check if user can send DM to another user
export const canSendDM = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const senderId = getSessionUserId(req);
    const receiverId =
      getParam(req.params.userId) ||
      String(req.body?.receiverId ?? "");

    if (!senderId || !receiverId) {
      return res.status(400).json({ error: "Sender and receiver required" });
    }

    const [senderRows, receiverRows] = await Promise.all([
      db.select().from(users).where(eq(users.id, senderId)).limit(1),
      db.select().from(users).where(eq(users.id, receiverId)).limit(1),
    ]);

    const senderUser = senderRows[0];
    const receiverUser = receiverRows[0];

    if (!senderUser || !receiverUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (receiverUser.allowMessages === false) {
      return res
        .status(403)
        .json({ error: "This user does not accept messages" });
    }

    if (receiverUser.messagePrivacy === "none") {
      return res
        .status(403)
        .json({ error: "This user does not accept messages" });
    }

    const receiverBlockedUsers = normalizeStringArray(
      (receiverUser as any).blockedUsers
    );
    const senderBlockedUsers = normalizeStringArray(
      (senderUser as any).blockedUsers
    );

    if (receiverBlockedUsers.includes(senderId)) {
      return res.status(403).json({ error: "You are blocked by this user" });
    }

    if (senderBlockedUsers.includes(receiverId)) {
      return res.status(403).json({ error: "You have blocked this user" });
    }

    // Existing follow/privacy behavior is preserved here.
    if (receiverUser.messagePrivacy === "followers" && receiverUser.isPrivate) {
      // TODO: check follows table if you want strict follower-only DMs.
    }

    if (receiverUser.messagePrivacy === "following") {
      // TODO: check whether receiver follows sender.
    }

    (req as any).receiverUser = receiverUser;
    return next();
  } catch (error) {
    console.error("DM permission check error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Check if user can view content (posts/videos)
export const canViewContent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const viewerId = getSessionUserId(req);
    const contentOwnerId =
      getParam(req.params.userId) ||
      String(req.body?.userId ?? "");

    if (!contentOwnerId) {
      return next();
    }

    const ownerRows = await db
      .select()
      .from(users)
      .where(eq(users.id, contentOwnerId))
      .limit(1);

    const ownerUser = ownerRows[0];

    if (!ownerUser) {
      return res.status(404).json({ error: "Content owner not found" });
    }

    if (
      ownerUser.contentVisibility === "private" &&
      viewerId !== contentOwnerId
    ) {
      return res.status(403).json({ error: "This content is private" });
    }

    if (
      ownerUser.contentVisibility === "friends" &&
      viewerId !== contentOwnerId
    ) {
      const closeFriends = normalizeStringArray(
        (ownerUser as any).closeFriends
      );

      if (!viewerId || !closeFriends.includes(viewerId)) {
        return res
          .status(403)
          .json({ error: "This content is only visible to friends" });
      }
    }

    const blockedUsers = normalizeStringArray(
      (ownerUser as any).blockedUsers
    );

    if (viewerId && blockedUsers.includes(viewerId)) {
      return res.status(403).json({ error: "You are blocked by this user" });
    }

    (req as any).contentOwner = ownerUser;
    return next();
  } catch (error) {
    console.error("Content view permission check error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Check if user can comment on content
export const canComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const commenterId = getSessionUserId(req);
    const contentOwnerId =
      getParam(req.params.userId) ||
      String(req.body?.userId ?? "");

    if (!commenterId || !contentOwnerId) {
      return res
        .status(400)
        .json({ error: "Commenter and content owner required" });
    }

    const ownerRows = await db
      .select()
      .from(users)
      .where(eq(users.id, contentOwnerId))
      .limit(1);

    const ownerUser = ownerRows[0];

    if (!ownerUser) {
      return res.status(404).json({ error: "Content owner not found" });
    }

    if (ownerUser.allowComments === false) {
      return res
        .status(403)
        .json({ error: "Comments are disabled for this content" });
    }

    const blockedUsers = normalizeStringArray(
      (ownerUser as any).blockedUsers
    );

    if (blockedUsers.includes(commenterId)) {
      return res.status(403).json({ error: "You are blocked by this user" });
    }

    (req as any).contentOwner = ownerUser;
    return next();
  } catch (error) {
    console.error("Comment permission check error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};