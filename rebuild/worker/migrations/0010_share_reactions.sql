CREATE TABLE IF NOT EXISTS share_reactions (
  share_id TEXT NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('like','thanks','idea')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (share_id, voter_hash)
);
CREATE INDEX IF NOT EXISTS share_reactions_share ON share_reactions(share_id, reaction);
