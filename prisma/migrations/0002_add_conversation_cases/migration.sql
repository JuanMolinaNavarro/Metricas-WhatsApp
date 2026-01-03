-- CreateTable
CREATE TABLE "conversation_cases" (
    "case_id" TEXT NOT NULL,
    "conversation_href" TEXT NOT NULL,
    "team_uuid" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "opened_received_at_utc" TIMESTAMPTZ NOT NULL,
    "opened_payload_created_at_utc" TIMESTAMPTZ,
    "first_response_at_utc" TIMESTAMPTZ,
    "first_response_seconds" INTEGER,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "local_date" DATE NOT NULL,
    "assigned_user_email" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "conversation_cases_pkey" PRIMARY KEY ("case_id")
);

-- CreateIndex
CREATE INDEX "conversation_cases_conversation_href_opened_received_at_utc_idx" ON "conversation_cases"("conversation_href", "opened_received_at_utc" DESC);

-- CreateIndex
CREATE INDEX "conversation_cases_local_date_idx" ON "conversation_cases"("local_date");

-- CreateIndex
CREATE INDEX "conversation_cases_team_uuid_idx" ON "conversation_cases"("team_uuid");

-- CreateIndex
CREATE INDEX "conversation_cases_team_uuid_local_date_idx" ON "conversation_cases"("team_uuid", "local_date");

-- CreateIndex
CREATE INDEX "idx_cases_agent" ON "conversation_cases"("assigned_user_email");

-- CreateIndex
CREATE INDEX "idx_cases_agent_date" ON "conversation_cases"("assigned_user_email", "local_date");

