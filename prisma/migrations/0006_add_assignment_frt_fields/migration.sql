-- Add assignment and first-response attribution fields for agent FRT.
ALTER TABLE "conversation_cases"
  ADD COLUMN "assigned_at_utc" TIMESTAMPTZ,
  ADD COLUMN "first_response_agent_email" TEXT;

-- Backfill existing rows with best available values.
UPDATE "conversation_cases"
SET "assigned_at_utc" = "opened_received_at_utc"
WHERE "assigned_user_email" IS NOT NULL
  AND "assigned_at_utc" IS NULL;

UPDATE "conversation_cases"
SET "first_response_agent_email" = "assigned_user_email"
WHERE "answered" = true
  AND "first_response_agent_email" IS NULL;

CREATE INDEX "conversation_cases_first_response_agent_email_idx"
  ON "conversation_cases"("first_response_agent_email");

CREATE INDEX "conversation_cases_first_response_agent_email_local_date_idx"
  ON "conversation_cases"("first_response_agent_email", "local_date");
