ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "can_send_messages" boolean DEFAULT true NOT NULL;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "can_send_media" boolean DEFAULT true NOT NULL;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "can_share_links" boolean DEFAULT true NOT NULL;
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "can_create_polls" boolean DEFAULT true NOT NULL;
--> statement-breakpoint

ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "is_muted" boolean DEFAULT false NOT NULL;
ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "is_banned" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "group_join_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "requested_at" timestamp DEFAULT now() NOT NULL,
  "decided_at" timestamp,
  "decided_by" text
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "group_join_requests_group_user_pending_idx"
ON "group_join_requests" ("group_id", "user_id", "status");
