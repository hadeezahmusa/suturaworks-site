-- Feedback after QLV 2026. One row per person, made when their certificate,
-- thank-you or feedback email goes, keyed the same way as the thank-yous:
-- c:<ticket id> sprinter (with a certificate), t:<ticket id> judge or mentor,
-- team:<lobby_team id> marshal, desk:<email>, f:<ticket id> facilitator.
-- The token is the person's own link, so every answer is tied to their email.
-- A sprinter's certificate downloads only once their feedback is in.
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_key TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  role TEXT,
  cert_ticket_id INTEGER,                 -- set for sprinters: the certificate waits on this row
  created_at TEXT NOT NULL,
  emailed_at TEXT,
  opened_at TEXT,
  submitted_at TEXT,
  overall INTEGER,                        -- 1 to 5
  expected TEXT,
  experienced TEXT,
  next_time TEXT,
  recommend INTEGER,                      -- 0 to 10
  attend_again TEXT,                      -- yes, maybe, no
  membership_info INTEGER,                -- 1 wants information about membership
  event_emails INTEGER,                   -- 1 wants emails about JCI Aso events
  socials TEXT                            -- JSON {instagram, linkedin, x, facebook, tiktok}
);
