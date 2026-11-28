ALTER TABLE comments ADD COLUMN anchor_x REAL;
ALTER TABLE comments ADD COLUMN anchor_y REAL;
CREATE INDEX IF NOT EXISTS comments_share_anchor ON comments(share_id, time_seconds, anchor_x, anchor_y);