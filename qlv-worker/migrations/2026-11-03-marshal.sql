-- Facilitators are the two keynote speakers, one for each day. They are not
-- QLV team: no lobby, no team rooms, no brief. The Lead Sprint Marshal is
-- someone on the QLV team list, marked here, and gets the run sheet.
ALTER TABLE lobby_team ADD COLUMN marshal INTEGER NOT NULL DEFAULT 0;

-- Switch off any lobby link a facilitator was sent, and their notifications.
UPDATE lobby_access SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE revoked_at IS NULL AND ticket_id IN (SELECT id FROM tickets WHERE kind = 'facilitator');
DELETE FROM push_subs WHERE ticket_id IN (SELECT id FROM tickets WHERE kind = 'facilitator');

-- Old facilitator run sheet packs, if any were made, and the lead/floor choice.
DELETE FROM packs WHERE role = 'facilitator';
UPDATE staff_roles SET facilitator_type = NULL WHERE facilitator_type IS NOT NULL;
