-- E-certificates for the sprinters checked in on Saturday, and thank-you
-- emails for judges, mentors/advisers, the Lead Sprint Marshal and the desk.
-- Facilitators get nothing from here: JCI Aso writes to them.
-- The PDFs are drawn in the admin's browser and kept in KV (cert:pdf:<id>).
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,   -- QLV26-C-001 upwards
  ticket_id INTEGER NOT NULL UNIQUE,
  printed_name TEXT NOT NULL,             -- starts as the ticket name; admin may correct it
  token TEXT NOT NULL UNIQUE,             -- the download link
  created_at TEXT NOT NULL,
  name_edited_at TEXT,
  name_edited_by TEXT,
  sent_at TEXT,
  sent_hash TEXT,                         -- what was on the certificate when sent
  sent_by TEXT
);

CREATE TABLE IF NOT EXISTS thanks_sent (
  key TEXT PRIMARY KEY,                   -- t:<ticket id>, team:<lobby_team id>, desk:<email>
  name TEXT,
  email TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  sent_by TEXT
);

-- Desk volunteers sign in by email only; a name lets the thank-you greet them.
ALTER TABLE access ADD COLUMN name TEXT;
