-- Lobby and team rooms (QLV-2026-Team-Rooms-Build-Spec.md). Personal links,
-- intros, the lobby and team walls, scheduled posts, read markers for the
-- unread badge, and Web Push subscriptions. The lobby state itself is one
-- JSON value in settings (key lobby); the VAPID keys are settings key vapid.
CREATE TABLE IF NOT EXISTS lobby_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  notified_at TEXT,           -- when the link reached them
  notified_by TEXT,           -- welcome (email) or ticket (inside the ticket email)
  announced_at TEXT,          -- the "Meet your QLV 2026 team" email
  last_opened_at TEXT,
  installed INTEGER NOT NULL DEFAULT 0,
  push_state TEXT             -- on, off or denied, as the phone reports it
);
CREATE INDEX IF NOT EXISTS lobby_access_ticket ON lobby_access(ticket_id);
CREATE TABLE IF NOT EXISTS lobby_intros (
  ticket_id INTEGER PRIMARY KEY,
  what_you_do TEXT,
  hoping_for TEXT,
  hide_org INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lobby_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  space TEXT NOT NULL,        -- lobby, or t:<table index>
  ticket_id INTEGER,
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  hidden_by TEXT,
  hidden_at TEXT
);
CREATE INDEX IF NOT EXISTS lobby_messages_space ON lobby_messages(space, id);
CREATE TABLE IF NOT EXISTS lobby_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audience TEXT NOT NULL,     -- lobby or rooms
  body TEXT NOT NULL,
  send_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled, sent or cancelled
  sent_at TEXT,
  notified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT
);
CREATE TABLE IF NOT EXISTS lobby_reads (
  ticket_id INTEGER NOT NULL,
  space TEXT NOT NULL,
  last_read_at TEXT NOT NULL,
  PRIMARY KEY (ticket_id, space)
);
CREATE TABLE IF NOT EXISTS push_subs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_success_at TEXT
);
CREATE INDEX IF NOT EXISTS push_subs_ticket ON push_subs(ticket_id);
-- Team message notifications waiting for the 15 minute gap or the morning.
CREATE TABLE IF NOT EXISTS push_queue (
  ticket_id INTEGER NOT NULL,
  space TEXT NOT NULL,
  pending INTEGER NOT NULL DEFAULT 0,
  last_sent_at TEXT,
  PRIMARY KEY (ticket_id, space)
);

-- The schedule from the spec, Africa/Lagos times stored as UTC. Admin edits
-- them before they go out. Only seeded into an empty table.
INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_by) SELECT 'lobby', 'Welcome to the QLV 2026 lobby! 👋🏽
This is where you''ll meet the people you''re building with on Saturday. Start by writing your intro, then say hello. Teams are revealed on Friday at 4:45pm, right here.', '2026-11-01T09:00:00Z', '2026-10-31T00:00:00Z', 'seed' WHERE NOT EXISTS (SELECT 1 FROM lobby_posts WHERE created_at = '2026-10-31T00:00:00Z' AND send_at = '2026-11-01T09:00:00Z');
INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_by) SELECT 'lobby', 'One small thing before you go: add QLV to your home screen 📲
It takes ten seconds, and it means your team room is one tap away on Friday. Turn on notifications while you''re there so you don''t miss the reveal.', '2026-11-01T17:00:00Z', '2026-10-31T00:00:00Z', 'seed' WHERE NOT EXISTS (SELECT 1 FROM lobby_posts WHERE created_at = '2026-10-31T00:00:00Z' AND send_at = '2026-11-01T17:00:00Z');
INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_by) SELECT 'lobby', 'New to sprints? Here''s the whole day in one minute ⏱️
Read the task, build on the board, hand it over, take the critique, then present. Watch the explainer: {explainer_link}', '2026-11-02T08:00:00Z', '2026-10-31T00:00:00Z', 'seed' WHERE NOT EXISTS (SELECT 1 FROM lobby_posts WHERE created_at = '2026-10-31T00:00:00Z' AND send_at = '2026-11-02T08:00:00Z');
INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_by) SELECT 'lobby', 'Question for the lobby 💭
Think of something at work or in your community that still runs well after the person who started it left. What made it last? Share it on the wall.', '2026-11-02T17:00:00Z', '2026-10-31T00:00:00Z', 'seed' WHERE NOT EXISTS (SELECT 1 FROM lobby_posts WHERE created_at = '2026-10-31T00:00:00Z' AND send_at = '2026-11-02T17:00:00Z');
INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_by) SELECT 'lobby', 'QLV 2026 is made possible by our partners 🙏🏽
A big thank you to everyone supporting this year''s programme. You''ll meet some of them on Saturday.', '2026-11-03T08:00:00Z', '2026-10-31T00:00:00Z', 'seed' WHERE NOT EXISTS (SELECT 1 FROM lobby_posts WHERE created_at = '2026-10-31T00:00:00Z' AND send_at = '2026-11-03T08:00:00Z');
INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_by) SELECT 'lobby', 'Know someone who''d love this? 🤝🏽
Registration closes tomorrow. Send them suturaworks.com/qlv2026 and save them a seat.', '2026-11-03T17:00:00Z', '2026-10-31T00:00:00Z', 'seed' WHERE NOT EXISTS (SELECT 1 FROM lobby_posts WHERE created_at = '2026-10-31T00:00:00Z' AND send_at = '2026-11-03T17:00:00Z');
INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_by) SELECT 'lobby', 'Last day to register for QLV 2026 ⏳
If a colleague has been meaning to sign up, today''s the day.', '2026-11-04T08:00:00Z', '2026-10-31T00:00:00Z', 'seed' WHERE NOT EXISTS (SELECT 1 FROM lobby_posts WHERE created_at = '2026-10-31T00:00:00Z' AND send_at = '2026-11-04T08:00:00Z');
INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_by) SELECT 'lobby', 'Tomorrow is day one 🎉
We meet online at 4:00pm. Have your phone handy, because at 4:45pm your team room opens right here.', '2026-11-05T08:00:00Z', '2026-10-31T00:00:00Z', 'seed' WHERE NOT EXISTS (SELECT 1 FROM lobby_posts WHERE created_at = '2026-10-31T00:00:00Z' AND send_at = '2026-11-05T08:00:00Z');
INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_by) SELECT 'lobby', 'Saturday checklist ✅
Arrive from 8:30am at Transcorp Hilton, Abuja, for breakfast of tea and light snacks. Everything you need for the sprint will be on your table. Just bring yourself and your best thinking.', '2026-11-05T17:00:00Z', '2026-10-31T00:00:00Z', 'seed' WHERE NOT EXISTS (SELECT 1 FROM lobby_posts WHERE created_at = '2026-10-31T00:00:00Z' AND send_at = '2026-11-05T17:00:00Z');
INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_by) SELECT 'lobby', 'It''s day one! 🚀
We go live at 4:00pm. Join here: {meet_link}', '2026-11-06T08:00:00Z', '2026-10-31T00:00:00Z', 'seed' WHERE NOT EXISTS (SELECT 1 FROM lobby_posts WHERE created_at = '2026-10-31T00:00:00Z' AND send_at = '2026-11-06T08:00:00Z');
INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_by) SELECT 'lobby', 'We start in 15 minutes ⏰
Grab a seat and join: {meet_link}', '2026-11-06T14:45:00Z', '2026-10-31T00:00:00Z', 'seed' WHERE NOT EXISTS (SELECT 1 FROM lobby_posts WHERE created_at = '2026-10-31T00:00:00Z' AND send_at = '2026-11-06T14:45:00Z');
