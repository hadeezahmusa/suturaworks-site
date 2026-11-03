-- Members can be added from the Member codes tab, as a member or an intending
-- member. An intending member pays the member rate and sits like a member;
-- only the label differs: on the badge, the ticket, the emails and the
-- registration. The ticket keeps its own copy so every place that shows a
-- ticket can read it without looking the member up again.
ALTER TABLE members ADD COLUMN status TEXT NOT NULL DEFAULT 'member';
ALTER TABLE members ADD COLUMN added_at TEXT;
ALTER TABLE members ADD COLUMN added_by TEXT;
ALTER TABLE tickets ADD COLUMN intending INTEGER NOT NULL DEFAULT 0;
