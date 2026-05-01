ALTER TABLE "posts" ADD COLUMN "video_type" text DEFAULT 'reels' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "orientation" text DEFAULT 'portrait';--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "aspect_ratio" real;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "duration" integer;