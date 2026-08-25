import express from "express";
import { db } from "../db";
import { users, reports } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "vidx445@gmail.com";
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "824906692";

const router = express.Router();

function getSessionUserId(req: express.Request): string {
  return String((req.session as any)?.userId ?? "");
}

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

router.get("/settings", authMiddleware, async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const [user] = await db
      .select({
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
        contentVisibility: users.contentVisibility,
        storyVisibility: users.storyVisibility,
        messagePrivacy: users.messagePrivacy,
        twoFactorEnabled: users.twoFactorEnabled,
        blockedUsers: users.blockedUsers,
        mutedUsers: users.mutedUsers,
        closeFriends: users.closeFriends,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      ...user,
      blockedUsers: normalizeStringArray(user.blockedUsers),
      mutedUsers: normalizeStringArray(user.mutedUsers),
      closeFriends: normalizeStringArray(user.closeFriends),
      officialEmail: SUPPORT_EMAIL,
      officialPhone: SUPPORT_PHONE,
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings", authMiddleware, async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const updates = req.body ?? {};

    const allowedFields = [
      "isPrivate",
      "allowMessages",
      "allowComments",
      "allowLikes",
      "allowShares",
      "allowStoryViews",
      "allowProfileViews",
      "allowTagging",
      "showOnlineStatus",
      "showLastSeen",
      "showReadReceipts",
      "encryptMessages",
      "contentVisibility",
      "storyVisibility",
      "messagePrivacy",
      "blockedUsers",
      "mutedUsers",
      "closeFriends",
    ] as const;

    const filteredUpdates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    await db
      .update(users)
      .set({
        ...(filteredUpdates as any),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return res.json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Update settings error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/block/:userId", authMiddleware, async (req, res) => {
  try {
    const blockerId = getSessionUserId(req);
    const blockedId = getParam(req.params.userId);

    if (!blockerId) return res.status(401).json({ error: "Not authenticated" });
    if (!blockedId) return res.status(400).json({ error: "User ID is required" });

    if (blockerId === blockedId) {
      return res.status(400).json({ error: "Cannot block yourself" });
    }

    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, blockedId))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({ error: "User to block not found" });
    }

    const [user] = await db
      .select({ blockedUsers: users.blockedUsers })
      .from(users)
      .where(eq(users.id, blockerId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    const blockedUsers = normalizeStringArray(user.blockedUsers);

    if (blockedUsers.includes(blockedId)) {
      return res.status(400).json({ error: "User already blocked" });
    }

    const nextBlockedUsers = [...blockedUsers, blockedId];

    await db
      .update(users)
      .set({
        blockedUsers: nextBlockedUsers as any,
        updatedAt: new Date(),
      })
      .where(eq(users.id, blockerId));

    return res.json({
      message: "User blocked successfully",
      blockedUsers: nextBlockedUsers,
    });
  } catch (error) {
    console.error("Block user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/block/:userId", authMiddleware, async (req, res) => {
  try {
    const blockerId = getSessionUserId(req);
    const blockedId = getParam(req.params.userId);

    if (!blockerId) return res.status(401).json({ error: "Not authenticated" });
    if (!blockedId) return res.status(400).json({ error: "User ID is required" });

    const [user] = await db
      .select({ blockedUsers: users.blockedUsers })
      .from(users)
      .where(eq(users.id, blockerId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    const blockedUsers = normalizeStringArray(user.blockedUsers);

    if (!blockedUsers.includes(blockedId)) {
      return res.status(400).json({ error: "User not blocked" });
    }

    const nextBlockedUsers = blockedUsers.filter((id) => id !== blockedId);

    await db
      .update(users)
      .set({
        blockedUsers: nextBlockedUsers as any,
        updatedAt: new Date(),
      })
      .where(eq(users.id, blockerId));

    return res.json({
      message: "User unblocked successfully",
      blockedUsers: nextBlockedUsers,
    });
  } catch (error) {
    console.error("Unblock user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/report", authMiddleware, async (req, res) => {
  try {
    const reporterId = getSessionUserId(req);

    if (!reporterId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const {
      reportedUserId,
      reportedPostId,
      reportedCommentId,
      reason,
      description,
    } = req.body ?? {};

    const cleanReason =
      typeof reason === "string" ? reason.trim() : "";

    if (!cleanReason) {
      return res.status(400).json({ error: "Report reason is required" });
    }

    const normalizedUserId =
      typeof reportedUserId === "string" && reportedUserId.trim()
        ? reportedUserId.trim()
        : null;

    const normalizedPostId =
      reportedPostId !== undefined &&
      reportedPostId !== null &&
      Number.isInteger(Number(reportedPostId))
        ? Number(reportedPostId)
        : null;

    const normalizedCommentId =
      reportedCommentId !== undefined &&
      reportedCommentId !== null &&
      Number.isInteger(Number(reportedCommentId))
        ? Number(reportedCommentId)
        : null;

    if (!normalizedUserId && !normalizedPostId && !normalizedCommentId) {
      return res
        .status(400)
        .json({ error: "Must report a user, post, or comment" });
    }

    await db.insert(reports).values({
      reporterId,
      reportedUserId: normalizedUserId,
      reportedPostId: normalizedPostId,
      reportedCommentId: normalizedCommentId,
      reason: cleanReason,
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : null,
    });

    return res.json({ message: "Report submitted successfully" });
  } catch (error) {
    console.error("Report error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;