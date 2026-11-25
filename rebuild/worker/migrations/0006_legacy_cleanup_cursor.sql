-- Persistent R2 orphan scan cursor, idempotent for scheduled cleanup.
CREATE TABLE IF NOT EXISTS legacy_cleanup_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cursor TEXT
);
INSERT OR IGNORE INTO legacy_cleanup_state(id,cursor) VALUES(1,NULL);
