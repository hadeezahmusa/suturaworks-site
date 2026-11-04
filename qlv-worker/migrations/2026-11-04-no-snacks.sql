-- Tea and light snacks are no longer served on Saturday: take them out of
-- the unsent Saturday checklist post.
UPDATE lobby_posts SET body = replace(body, 'Arrive from 8:30am at Transcorp Hilton, Abuja, for breakfast of tea and light snacks.', 'Arrive from 8:30am at Transcorp Hilton, Abuja.')
  WHERE sent_at IS NULL AND body LIKE '%tea and light snacks%';
