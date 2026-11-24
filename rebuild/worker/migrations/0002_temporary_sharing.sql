ALTER TABLE recordings ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  recording_id TEXT NOT NULL UNIQUE REFERENCES recordings(id) ON DELETE CASCADE,
  owner_token_hash TEXT NOT NULL REFERENCES guest_sessions(token_hash) ON DELETE CASCADE,
  owner_key_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  password_salt TEXT,
  password_hash TEXT,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS share_access_sessions (
  token_hash TEXT PRIMARY KEY,
  share_id TEXT NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  author_hash TEXT NOT NULL,
  viewer_label TEXT NOT NULL DEFAULT 'Guest',
  body TEXT NOT NULL,
  time_seconds INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS shares_expiry ON shares(expires_at);
CREATE INDEX IF NOT EXISTS comments_share_created ON comments(share_id, created_at);
CREATE INDEX IF NOT EXISTS comments_parent ON comments(parent_id);