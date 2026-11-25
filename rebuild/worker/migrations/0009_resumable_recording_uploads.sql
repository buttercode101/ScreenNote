ALTER TABLE recordings ADD COLUMN upload_until INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS recording_upload_parts (
  recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  byte_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (recording_id, part_number)
);
CREATE INDEX IF NOT EXISTS recording_upload_parts_recording ON recording_upload_parts(recording_id, part_number);
