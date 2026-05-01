ALTER TABLE posts
ADD COLUMN IF NOT EXISTS expires_at timestamp;

CREATE INDEX IF NOT EXISTS posts_story_expiry_idx ON posts (expires_at);
