-- Name stickers for sprinters, and late additions seated by hand.
-- After "Lock and stamp" on the badge export, anyone who becomes due for a
-- seat is not seated automatically: they are flagged as a late addition and
-- admin or the desk seats them by hand.
ALTER TABLE tickets ADD COLUMN late_addition INTEGER;   -- 1 once flagged
ALTER TABLE tickets ADD COLUMN late_added_at TEXT;
ALTER TABLE tickets ADD COLUMN seated_by TEXT;          -- auto, admin or desk
ALTER TABLE tickets ADD COLUMN seated_by_user TEXT;
