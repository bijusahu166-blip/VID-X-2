ALTER TABLE "posts" ALTER COLUMN "image_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "song_video_id" text;