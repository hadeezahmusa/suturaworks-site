-- Research survey storage. Answers and contact details are kept in separate tables,
-- linked only by the random reference given to the respondent.
CREATE TABLE IF NOT EXISTS responses (
  ref        TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  role       TEXT NOT NULL,
  answers    TEXT NOT NULL  -- JSON object keyed by question id
);

CREATE TABLE IF NOT EXISTS contacts (
  ref             TEXT PRIMARY KEY,
  created_at      TEXT NOT NULL,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  location        TEXT,
  wants_results   INTEGER NOT NULL DEFAULT 0,
  wants_interview INTEGER NOT NULL DEFAULT 0
);
