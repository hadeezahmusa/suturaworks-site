-- The QLV team in the lobby: organisers who see the lobby and every team
-- room through their own personal link, labelled "QLV team". They have no
-- ticket, so lobby_access, lobby_intros and lobby_messages refer to them by
-- the negative of their id here, which can never be a ticket id.
CREATE TABLE IF NOT EXISTS lobby_team (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  removed_at TEXT
);
