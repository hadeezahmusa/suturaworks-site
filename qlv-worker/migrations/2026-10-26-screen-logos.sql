-- Logos and names shown on the projector's thank-you slide. Partners and
-- sponsored-seat sponsors get a row when a logo or display name is added;
-- JCI Aso members' businesses exist only here. The image itself is in KV
-- under logo:<id>.
CREATE TABLE IF NOT EXISTS screen_logos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,        -- partner, sponsor or member
  source_ref TEXT,             -- partner id or registration ref; null for a member's business
  name TEXT,                   -- name on screen; null means the registered name
  owner TEXT,                  -- the JCI Aso member behind a member's business
  logo_type TEXT,
  logo_size INTEGER,
  logo_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS screen_logos_source ON screen_logos(source, source_ref) WHERE source_ref IS NOT NULL;
