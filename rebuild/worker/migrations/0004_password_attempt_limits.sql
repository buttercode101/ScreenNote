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
