-- Minimal deleted/expired share tombstones prevent legacy fallback resurrection.
CREATE TABLE IF NOT EXISTS legacy_clip_tombstones (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  deleted_at INTEGER NOT NULL,
  reason TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS legacy_clip_tombstone_expiry ON legacy_clip_tombstones(deleted_at);
