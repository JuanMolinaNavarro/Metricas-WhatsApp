-- Add historical abandonment flag to conversation_cases
ALTER TABLE "conversation_cases" ADD COLUMN "was_abandoned_24h" BOOLEAN;

-- Backfill closed cases: mark those where the case was closed 24h+ after the last inbound
UPDATE "conversation_cases"
SET "was_abandoned_24h" = (
  "last_message_status" = 'received'
  AND "last_inbound_at_utc" IS NOT NULL
  AND "closed_received_at_utc" >= "last_inbound_at_utc" + interval '24 hours'
)
WHERE "is_closed" = true;
