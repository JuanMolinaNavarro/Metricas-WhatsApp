-- AlterTable
ALTER TABLE "conversation_cases"
ADD COLUMN "last_inbound_at_utc" TIMESTAMPTZ,
ADD COLUMN "last_outbound_at_utc" TIMESTAMPTZ,
ADD COLUMN "last_message_status" "MessageStatus";

