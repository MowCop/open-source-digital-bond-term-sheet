DROP POLICY IF EXISTS "Approved users can receive realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Approved users can send realtime" ON realtime.messages;

-- Restrict realtime to postgres_changes only. Broadcast/presence topics are
-- denied unless the caller is a participant of the chat channel referenced by
-- the topic (topic convention: 'chat:<channel_id>').
CREATE POLICY "Approved users can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.is_approved(auth.uid())
  AND (
    extension = 'postgres_changes'
    OR (
      extension IN ('broadcast', 'presence')
      AND realtime.topic() LIKE 'chat:%'
      AND EXISTS (
        SELECT 1 FROM public.chat_channels c
        WHERE c.id = split_part(realtime.topic(), ':', 2)
          AND c.participant_ids ? auth.uid()::text
      )
    )
  )
);

CREATE POLICY "Approved users can send realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_approved(auth.uid())
  AND (
    extension = 'postgres_changes'
    OR (
      extension IN ('broadcast', 'presence')
      AND realtime.topic() LIKE 'chat:%'
      AND EXISTS (
        SELECT 1 FROM public.chat_channels c
        WHERE c.id = split_part(realtime.topic(), ':', 2)
          AND c.participant_ids ? auth.uid()::text
      )
    )
  )
);