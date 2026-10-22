-- QLV 2026 admin additions, part 2: settings, extra sign-in roles, rebalance,
-- check-in, tasks and briefings, judges' scores and the stage.
-- Additive only: new tables and new nullable columns. Run once on the live database:
--   npx wrangler d1 execute qlv2026 --remote --file=migrations/2026-10-24-part2.sql

-- Editable settings, one JSON value per key. Missing keys use the defaults in src/settings.js.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- Extra sign-ins managed from the Settings tab: desk volunteers and stage operators.
-- Admins and the treasurer still come from ADMIN_EMAILS and VERIFIER_EMAILS.
CREATE TABLE IF NOT EXISTS access (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL,            -- desk, stage
  added_at TEXT NOT NULL,
  added_by TEXT NOT NULL
);

-- Seated after the teams were announced: told directly, never moved.
ALTER TABLE tickets ADD COLUMN late_after_freeze INTEGER;

-- Every rebalance, kept for the record.
CREATE TABLE IF NOT EXISTS rebalances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  option TEXT NOT NULL,          -- spread, even
  moves TEXT NOT NULL,           -- JSON: [{ id, name, from, to }]
  applied_at TEXT NOT NULL,
  applied_by TEXT NOT NULL
);

-- Check-in at the badge desk (optional). Removing a row undoes an arrival.
CREATE TABLE IF NOT EXISTS checkins (
  ticket_id INTEGER PRIMARY KEY,
  arrived_at TEXT NOT NULL,
  marked_by TEXT NOT NULL
);

-- What each staff member does on the day. One row per staff ticket.
CREATE TABLE IF NOT EXISTS staff_roles (
  ticket_id INTEGER PRIMARY KEY,
  mentor INTEGER NOT NULL DEFAULT 0,
  judge INTEGER NOT NULL DEFAULT 0,
  facilitator_type TEXT,         -- lead, floor (facilitators only)
  tables TEXT,                   -- JSON array of table indexes: a mentor's route or a facilitator's tables
  start_table INTEGER,           -- where a mentor starts at 10:50
  updated_at TEXT NOT NULL
);

-- One task per table, written by admin. Never sent in an email.
CREATE TABLE IF NOT EXISTS tasks (
  table_index INTEGER PRIMARY KEY,
  title TEXT,
  situation TEXT,
  problem TEXT,
  constraints TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- Editable wording for every pack, email and printed sheet. Missing keys use the defaults in src/templates.js.
CREATE TABLE IF NOT EXISTS templates (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- Generated packs, one per person per role (a mentor who also judges has two).
CREATE TABLE IF NOT EXISTS packs (
  ticket_id INTEGER NOT NULL,
  role TEXT NOT NULL,            -- facilitator, mentor, judge
  content TEXT NOT NULL,         -- JSON: the filled documents
  content_hash TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  sent_at TEXT,
  sent_hash TEXT,
  stale INTEGER NOT NULL DEFAULT 0, -- tables changed since it was generated: generate again
  PRIMARY KEY (ticket_id, role)
);

-- Long random links: a person's brief, a judge's scoring page, the projector display.
CREATE TABLE IF NOT EXISTS access_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER,             -- null for the display
  kind TEXT NOT NULL,            -- brief, scoring, display
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  opened_at TEXT
);
CREATE INDEX IF NOT EXISTS access_tokens_person ON access_tokens (ticket_id, kind);

-- Judges' scores. One per judge per table.
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  judge_ticket_id INTEGER NOT NULL,
  table_index INTEGER NOT NULL,
  c1 INTEGER NOT NULL, c2 INTEGER NOT NULL, c3 INTEGER NOT NULL, c4 INTEGER NOT NULL, c5 INTEGER NOT NULL,
  total INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 1,
  unlocked_by TEXT,
  unlocked_at TEXT,
  unlock_reason TEXT,
  UNIQUE (judge_ticket_id, table_index)
);

-- Every unlock, so a score changed after submission can always be explained.
CREATE TABLE IF NOT EXISTS score_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  judge_ticket_id INTEGER NOT NULL,
  table_index INTEGER NOT NULL,
  previous TEXT NOT NULL,        -- JSON of the five values and the total before the unlock
  reason TEXT NOT NULL,
  unlocked_by TEXT NOT NULL,
  unlocked_at TEXT NOT NULL
);

-- The projector and the control page share this single row.
CREATE TABLE IF NOT EXISTS stage_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state TEXT NOT NULL,           -- JSON, see src/stage.js
  updated_at TEXT NOT NULL
);
