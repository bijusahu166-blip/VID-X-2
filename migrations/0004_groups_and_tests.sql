-- Groups table
CREATE TABLE IF NOT EXISTS "groups" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "image_url" text,
  "is_public" boolean DEFAULT true NOT NULL,
  "creator_id" text NOT NULL,
  "member_count" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Group members table
CREATE TABLE IF NOT EXISTS "group_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "role" text DEFAULT 'member' NOT NULL,
  "joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Group posts table
CREATE TABLE IF NOT EXISTS "group_posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "content" text,
  "image_url" text,
  "type" text DEFAULT 'post' NOT NULL,
  "test_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Tests table
CREATE TABLE IF NOT EXISTS "tests" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "creator_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "timer_minutes" integer DEFAULT 10 NOT NULL,
  "marks_per_question" integer DEFAULT 1 NOT NULL,
  "total_questions" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Test questions table
CREATE TABLE IF NOT EXISTS "test_questions" (
  "id" serial PRIMARY KEY NOT NULL,
  "test_id" integer NOT NULL REFERENCES "tests"("id") ON DELETE CASCADE,
  "question" text NOT NULL,
  "option_a" text NOT NULL,
  "option_b" text NOT NULL,
  "option_c" text NOT NULL,
  "option_d" text NOT NULL,
  "correct_option" text NOT NULL,
  "explanation" text,
  "order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint

-- Test attempts table
CREATE TABLE IF NOT EXISTS "test_attempts" (
  "id" serial PRIMARY KEY NOT NULL,
  "test_id" integer NOT NULL REFERENCES "tests"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "score" integer DEFAULT 0 NOT NULL,
  "total_marks" integer DEFAULT 0 NOT NULL,
  "time_taken" integer DEFAULT 0 NOT NULL,
  "completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Test answers table
CREATE TABLE IF NOT EXISTS "test_answers" (
  "id" serial PRIMARY KEY NOT NULL,
  "attempt_id" integer NOT NULL REFERENCES "test_attempts"("id") ON DELETE CASCADE,
  "question_id" integer NOT NULL REFERENCES "test_questions"("id") ON DELETE CASCADE,
  "selected_option" text,
  "is_correct" boolean DEFAULT false NOT NULL
);
