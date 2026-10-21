-- QLV 2026: correcting JCI Aso member names and codes from the admin.
-- Every correction is kept here. When a code changes, the old code is kept
-- too and still works on the registration page, because the old list was
-- shared in the WhatsApp group; it leads to the member's current code.
-- Additive only. Run once on the live database:
--   npx wrangler d1 execute qlv2026 --remote --file=migrations/2026-10-23-member-corrections.sql

CREATE TABLE IF NOT EXISTS member_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  old_code TEXT NOT NULL,
  code TEXT NOT NULL,           -- the member's current code; kept up to date if it changes again
  old_name TEXT,
  new_name TEXT,
  old_email TEXT,
  new_email TEXT,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS member_changes_old ON member_changes (old_code);
CREATE INDEX IF NOT EXISTS member_changes_code ON member_changes (code);
