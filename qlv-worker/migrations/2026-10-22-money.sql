-- QLV 2026 Money tab: spending, in-kind support and other income.
-- Ticket and partnership income are not stored here; they are read from
-- registrations and partners, so they can never disagree with those pages.
-- Additive only. Run once on the live database:
--   npx wrangler d1 execute qlv2026 --remote --file=migrations/2026-10-22-money.sql

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,           -- spend (cash out), in_kind (given, no cash), income (other cash in)
  entry_date TEXT NOT NULL,     -- YYYY-MM-DD: when it was paid, given or received
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  party TEXT,                   -- paid to, given by, or received from
  party_type TEXT,              -- member, organisation, individual (in-kind and income)
  amount INTEGER NOT NULL,      -- naira; for in-kind, the estimated value
  value_basis TEXT,             -- in-kind: how the value was worked out
  status TEXT,                  -- spend: paid or owed
  method TEXT,                  -- transfer, cash, pos, card
  paid_from TEXT,               -- spend: which account or person paid
  reference TEXT,               -- transfer reference, invoice or receipt number
  notes TEXT,
  receipt_type TEXT,            -- the file itself is in KV under receipt:<id>
  receipt_size INTEGER,
  receipt_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT,
  deleted_at TEXT,              -- removed entries are kept for the record, never counted
  deleted_by TEXT
);
CREATE INDEX IF NOT EXISTS ledger_kind ON ledger (kind, entry_date);
