CREATE TABLE IF NOT EXISTS guest_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,
  owner_token_hash TEXT NOT NULL REFERENCES guest_sessions(token_hash) ON DELETE CASCADE,
  title TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('uploading', 'ready', 'failed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS recordings_owner_created
  ON recordings(owner_token_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS sessions_expiry
  ON guest_sessions(expires_at);
CREATE TABLE IF NOT EXISTS share_password_attempts (
  share_id TEXT NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  window_started INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (share_id, ip_hash)
);

CREATE INDEX IF NOT EXISTS share_password_attempts_window
  ON share_password_attempts(window_started);


-- Native 0.5.0 API tables are defined in migrations/0005_legacy_clip_api.sql.
