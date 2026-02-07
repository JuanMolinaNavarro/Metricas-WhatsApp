-- Backfill assigned_user_email for open cases using the latest message_created payload.
-- Safe to run multiple times (updates only open cases).

WITH last_msg AS (
  SELECT
    conversation_href,
    (payload->'payload'->'contact'->>'assignedUser') AS assigned_user_email,
    ROW_NUMBER() OVER (PARTITION BY conversation_href ORDER BY created_at_utc DESC) AS rn
  FROM messages_raw
  WHERE payload->>'event' = 'message_created'
)
UPDATE conversation_cases c
SET assigned_user_email = lm.assigned_user_email,
    updated_at = now()
FROM last_msg lm
WHERE lm.rn = 1
  AND lm.assigned_user_email IS NOT NULL
  AND c.conversation_href = lm.conversation_href
  AND c.is_closed = false;
