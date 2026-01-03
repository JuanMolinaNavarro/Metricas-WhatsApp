-- AlterTable
ALTER TABLE "conversation_cases"
ADD COLUMN "closed_received_at_utc" TIMESTAMPTZ,
ADD COLUMN "closed_payload_closed_at_utc" TIMESTAMPTZ,
ADD COLUMN "duration_seconds" INTEGER,
ADD COLUMN "is_closed" BOOLEAN NOT NULL DEFAULT false;
