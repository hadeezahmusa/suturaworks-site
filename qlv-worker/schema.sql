-- QLV 2026 registration. Apply with:
--   npx wrangler d1 execute qlv2026 --remote --file=schema.sql

-- Atomic counters for references. "main" gives QLV26-001, "sponsored" gives
-- QLV26-S01 and "adviser" gives QLV26-A01. Incremented with
-- UPDATE ... RETURNING, never by counting rows.
CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);
INSERT OR IGNORE INTO counters (name, n) VALUES ('main', 0), ('sponsored', 0), ('adviser', 0);

-- One row per booking: a standard or member seat, a corporate pack, a
-- sponsor's block of seats or an adviser.
-- status: awaiting -> verified (tickets made, not sent) -> confirmed (sent)
--         awaiting -> queried -> awaiting (new proof) ...
--         awaiting or queried -> released
CREATE TABLE IF NOT EXISTS registrations (
  ref TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  tier TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 1,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  organisation TEXT,
  situation TEXT,
  member_no TEXT,
  member_year TEXT,
  contact_person TEXT,
  named_publicly INTEGER,
  role TEXT,
  invited_by TEXT,
  mode TEXT,
  attendees TEXT,          -- corporate: JSON list of {name, email, role, situation, judge}
  proof_type TEXT,
  proof_size INTEGER,
  proof_at TEXT,
  query_note TEXT,
  claim_token TEXT UNIQUE, -- sponsored: the link the sponsor forwards
  manage_token TEXT UNIQUE,-- sponsored: the sponsor's private tracker
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  verified_at TEXT,
  sent_at TEXT,
  queried_at TEXT,
  released_at TEXT
);
CREATE INDEX IF NOT EXISTS registrations_status ON registrations (status, created_at);

-- One row per person admitted. Corporate packs get one per attendee plus the
-- judge or mentor, all carrying the booking reference. Claimed sponsored
-- seats get their own S reference, advisers an A reference.
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  reg_ref TEXT NOT NULL REFERENCES registrations (ref),
  ticket_ref TEXT NOT NULL,
  kind TEXT NOT NULL,      -- standard, member, corporate, judge, sponsored, adviser
  seat_no INTEGER,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  situation TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS tickets_reg ON tickets (reg_ref, kind);

-- The three questions. Stored apart from names: the admin view and the CSV
-- show only the branch and the text. holder is kept so a deletion request
-- can be honoured and repeat sends can be capped.
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  holder TEXT NOT NULL,
  branch TEXT NOT NULL,
  a1 TEXT,
  a2 TEXT,
  a3 TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS answers_holder ON answers (holder);

-- Every email the system sends or tries to send.
CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT,
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  ok INTEGER NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

-- JCI Aso members and their personal codes, loaded from the list JCI Aso
-- supplied. Not kept in the repository: load it with a generated SQL file.
CREATE TABLE IF NOT EXISTS members (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS registrations_member ON registrations (member_no);
