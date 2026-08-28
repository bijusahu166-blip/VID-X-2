import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean, integer, text } from "drizzle-orm/pg-core";

// Session storage table.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
 export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  email: varchar("email").unique(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  username: varchar("username").unique(),
  profileImageUrl: varchar("profile_image_url"),
  bio: varchar("bio"),
  pet: varchar("pet"),

  // Premium Signature
  premiumSignature: text("premium_signature"),
  signatureStyle: text("signature_style"),
  signatureActive: boolean("signature_active").default(false),
  signatureExpiresAt: timestamp("signature_expires_at"),

  isCelebrity: boolean("is_celebrity").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  goal: varchar("goal"),
  goalSetAt: timestamp("goal_set_at"),

  // Privacy & Security Fields
  isPrivate: boolean("is_private").default(false),
  allowMessages: boolean("allow_messages").default(true),
  allowComments: boolean("allow_comments").default(true),
  allowLikes: boolean("allow_likes").default(true),
  allowShares: boolean("allow_shares").default(true),
  allowStoryViews: boolean("allow_story_views").default(true),
  allowProfileViews: boolean("allow_profile_views").default(true),
  allowTagging: boolean("allow_tagging").default(true),
  showOnlineStatus: boolean("show_online_status").default(true),
  showLastSeen: boolean("show_last_seen").default(true),
  showReadReceipts: boolean("show_read_receipts").default(true),
  encryptMessages: boolean("encrypt_messages").default(true),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret"),
  coins: integer("coins").default(0),
  isPro: boolean("is_pro").default(false),
  subscriptionStatus: varchar("subscription_status").default("inactive"),
  subscriptionPlan: varchar("subscription_plan"),
  languagePreference: varchar("language_preference").default("en"),
  blockedUsers: jsonb("blocked_users").default([]),
  mutedUsers: jsonb("muted_users").default([]),
  closeFriends: jsonb("close_friends").default([]),
  contentVisibility: varchar("content_visibility").default("public"),
  storyVisibility: varchar("story_visibility").default("public"),
  messagePrivacy: varchar("message_privacy").default("everyone"),
},
(table) => [
  index("IDX_users_email").on(table.email),
  index("IDX_users_username").on(table.username),
  index("IDX_users_created_at").on(table.createdAt),
  index("IDX_users_is_celebrity").on(table.isCelebrity),
]);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
