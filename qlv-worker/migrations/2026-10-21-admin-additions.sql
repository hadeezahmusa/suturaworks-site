-- QLV 2026 admin additions: tables, partners, staff, badge export.
-- Additive only: new tables and new nullable columns. Nothing existing is
-- renamed, dropped or retyped. Run once on the live database:
--   npx wrangler d1 execute qlv2026 --remote --file=migrations/2026-10-21-admin-additions.sql

-- Where each person sits. table_seat is new because tickets.seat_no already
-- means the seat order within a corporate booking.
ALTER TABLE tickets ADD COLUMN table_index INTEGER;
ALTER TABLE tickets ADD COLUMN table_seat INTEGER;
ALTER TABLE tickets ADD COLUMN seated_at TEXT;
ALTER TABLE tickets ADD COLUMN org_key TEXT;
ALTER TABLE tickets ADD COLUMN organisation TEXT;     -- what the person typed, where the booking did not give it
ALTER TABLE tickets ADD COLUMN badge_name TEXT;       -- null means use the registered name
ALTER TABLE tickets ADD COLUMN partner_id INTEGER;
ALTER TABLE tickets ADD COLUMN days TEXT;             -- both, sat or fri; null means the default for the kind
ALTER TABLE tickets ADD COLUMN cancelled_at TEXT;     -- refund or cancellation: the seat is freed

-- Two people can never hold the same seat, however close together they are
-- seated. This is what keeps seating safe when payments are verified at once.
CREATE UNIQUE INDEX IF NOT EXISTS tickets_table_seat ON tickets (table_index, table_seat) WHERE table_index IS NOT NULL;

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reg_ref TEXT UNIQUE,          -- a registrations row of tier 'partner' that their tickets hang from
  name TEXT NOT NULL,
  level TEXT NOT NULL,          -- lead, supporting, community
  amount INTEGER NOT NULL,      -- copied from the level when created
  seats_total INTEGER NOT NULL,
  status TEXT NOT NULL,         -- awaiting_payment, confirmed
  confirmed_at TEXT,
  payment_note TEXT,
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

-- One row per partner seat: its own claim link, voidable and resendable.
CREATE TABLE IF NOT EXISTS partner_seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL REFERENCES partners (id),
  seat_no INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ticket_id INTEGER UNIQUE,     -- set when claimed
  voided_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS export_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO counters (name, n) VALUES ('partner', 0), ('facilitator', 0);
