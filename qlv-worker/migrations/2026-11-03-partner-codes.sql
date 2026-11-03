-- Non-paying partners (the JCI Aso members' businesses on the logo wall) each
-- get one personal code. Their nominee types it on the site and gets one free
-- ticket, a normal partner ticket that takes a table. The codes themselves
-- are made by the Worker and live only in the database, never in the code.
CREATE TABLE IF NOT EXISTS partner_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  logo_id INTEGER NOT NULL REFERENCES screen_logos (id),
  name TEXT NOT NULL,           -- the partner's name when the code was made
  ticket_id INTEGER UNIQUE,     -- set when redeemed
  redeemed_at TEXT,
  voided_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_codes_live ON partner_codes (logo_id) WHERE voided_at IS NULL;

-- Every redeemed ticket hangs from this one registration. Amount zero: no
-- money is involved, and it never shows in the registrations list.
INSERT OR IGNORE INTO registrations (ref, secret, tier, size, amount, status, name, email, organisation, contact_person, created_at, updated_at, verified_at, sent_at)
  VALUES ('PTN-FREE', lower(hex(randomblob(12))), 'partner', 0, 0, 'confirmed', 'Non-paying partners', '', 'Non-paying partners', 'QLV 2026',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
