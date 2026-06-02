-- Create pending_blocks table for temporary blocks from reports
CREATE TABLE IF NOT EXISTS pending_blocks (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reported_user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  block_until TIMESTAMP NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX idx_pending_blocks_reported_user ON pending_blocks(reported_user_id);
CREATE INDEX idx_pending_blocks_blocked_user ON pending_blocks(blocked_user_id);
CREATE INDEX idx_pending_blocks_block_until ON pending_blocks(block_until);
CREATE INDEX idx_pending_blocks_post_blocked ON pending_blocks(post_id, blocked_user_id);
