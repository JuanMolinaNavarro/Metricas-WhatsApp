-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('received', 'sent');

-- CreateTable
CREATE TABLE "messages_raw" (
    "uuid" TEXT NOT NULL,
    "conversation_href" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "channel" TEXT NOT NULL,
    "created_at_utc" TIMESTAMPTZ NOT NULL,
    "payload" JSONB NOT NULL,
    "inserted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "messages_raw_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "conversation_day_metrics" (
    "conversation_href" TEXT NOT NULL,
    "local_date" DATE NOT NULL,
    "first_inbound_at_utc" TIMESTAMPTZ,
    "first_outbound_after_inbound_at_utc" TIMESTAMPTZ,
    "inbound_count_day" INTEGER NOT NULL DEFAULT 0,
    "outbound_count_day" INTEGER NOT NULL DEFAULT 0,
    "answered_same_day" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "conversation_day_metrics_pkey" PRIMARY KEY ("conversation_href", "local_date")
);

-- CreateIndex
CREATE INDEX "conversation_day_metrics_local_date_idx" ON "conversation_day_metrics"("local_date");

