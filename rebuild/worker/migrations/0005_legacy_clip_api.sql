-- Native ScreenNote 0.5.0 API storage and quota ledger. Safe to reapply.
CREATE TABLE IF NOT EXISTS legacy_capacity (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  reserved_bytes INTEGER NOT NULL DEFAULT 0,
  reserved_count INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO legacy_capacity(id,reserved_bytes,reserved_count) VALUES(1,0,0);
CREATE TABLE IF NOT EXISTS legacy_clip_records (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  duration_seconds REAL NOT NULL,
  expires_at INTEGER NOT NULL,
  upload_until INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  object_key TEXT NOT NULL,
  data TEXT NOT NULL,
  media_token_hash TEXT,
  media_token_expires INTEGER
);
CREATE INDEX IF NOT EXISTS legacy_clip_status_expiry ON legacy_clip_records(status,expires_at,upload_until);
CREATE TABLE IF NOT EXISTS legacy_clip_parts (
  clip_id TEXT NOT NULL,
  part INTEGER NOT NULL,
  object_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(clip_id,part),
  FOREIGN KEY(clip_id) REFERENCES legacy_clip_records(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS legacy_clip_parts_created ON legacy_clip_parts(created_at);
CREATE TABLE IF NOT EXISTS legacy_clip_password_attempts (
  clip_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  window_started INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(clip_id,ip_hash)
);
CREATE INDEX IF NOT EXISTS legacy_clip_password_lock ON legacy_clip_password_attempts(locked_until);
