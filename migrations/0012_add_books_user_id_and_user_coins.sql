ALTER TABLE books
  ADD COLUMN user_id text;

ALTER TABLE users
  ADD COLUMN coins integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS IDX_books_user_id ON books(user_id);
