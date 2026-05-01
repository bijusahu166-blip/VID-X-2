CREATE TABLE IF NOT EXISTS story_views (
  id serial PRIMARY KEY,
  post_id integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT story_views_post_viewer_unique UNIQUE (post_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS story_views_post_id_idx ON story_views (post_id);
CREATE INDEX IF NOT EXISTS story_views_viewer_id_idx ON story_views (viewer_id);
