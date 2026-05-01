ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_visibility" varchar DEFAULT 'everyone';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hide_last_seen" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hide_online_status" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hide_profile_photo" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "who_can_message" varchar DEFAULT 'everyone';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "unknown_messages_to_requests" boolean DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "read_receipts_enabled" boolean DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "study_mode" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "app_lock_enabled" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "app_lock_pin_hash" varchar;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "message_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "requester_id" text NOT NULL,
  "receiver_id" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "decided_at" timestamp
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "message_requests_unique_pending_idx"
ON "message_requests" ("requester_id", "receiver_id", "status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  "reporter_id" text NOT NULL,
  "target_user_id" text NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
