CREATE TABLE IF NOT EXISTS share_action_rate_limits (
  share_id TEXT NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('comment', 'review', 'reaction')),
  window_started INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (share_id, ip_hash, action)
);
CREATE INDEX IF NOT EXISTS share_action_rate_limits_window ON share_action_rate_limits(window_started);
