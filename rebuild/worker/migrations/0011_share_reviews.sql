CREATE TABLE IF NOT EXISTS share_reviews (
  share_id TEXT NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  reviewer_hash TEXT NOT NULL,
  reviewer_label TEXT NOT NULL DEFAULT 'Guest',
  decision TEXT NOT NULL CHECK (decision IN ('approved','changes-requested','question')),
  comment TEXT NOT NULL DEFAULT '',
  time_seconds REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (share_id, reviewer_hash)
);
CREATE INDEX IF NOT EXISTS share_reviews_share_updated ON share_reviews(share_id, updated_at DESC);
