import { DateTime } from "luxon";
import { prisma } from "../db/prisma.js";

const LOCAL_TZ = "America/Argentina/Tucuman";

type MessageStatus = "received" | "sent";

export type MessageCreatedPayload = {
  uuid: string;
  status: MessageStatus;
  channel: string;
  createdAt?: string;
  to?: string;
  from?: string;
  text?: string;
  contact: {
    conversationHref?: string;
    href?: string;
    uuid?: string;
    source?: string;
    team?: {
      uuid?: string;
      name?: string;
    };
    assignedUser?: string;
    name?: string;
    phoneNumber?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

export type ConversationOpenedPayload = {
  source?: string;
  href?: string;
  createdAt?: string;
  contact: {
    team?: {
      uuid?: string;
      name?: string;
    };
    assignedUser?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

export type ConversationClosedPayload = {
  source?: string;
  href?: string;
  closedAt?: string;
  contact?: {
    [key: string]: any;
  };
  [key: string]: any;
};

function computeLocalDate(dateTimeUtc: DateTime) {
  const localDate = dateTimeUtc.setZone(LOCAL_TZ).toISODate();
  if (!localDate) {
    throw new Error("Unable to compute local date");
  }
  return localDate;
}

export async function handleConversationOpened(payload: ConversationOpenedPayload, rawBody: unknown) {
  if (payload.source !== "whatsapp") {
    return { ignored: true, reason: "non_whatsapp_source" };
  }

  const openedReceivedAtUtc = DateTime.utc();
  const openedReceivedDate = openedReceivedAtUtc.toJSDate();
  const localDate = computeLocalDate(openedReceivedAtUtc);

  const createdAtUtc = payload.createdAt
    ? DateTime.fromISO(payload.createdAt, { zone: "utc" })
    : null;
  const openedPayloadCreatedAtDate = createdAtUtc && createdAtUtc.isValid ? createdAtUtc.toJSDate() : null;

  const conversationHref = payload.href;
  if (!conversationHref) {
    throw new Error("Missing conversation href");
  }

  const teamUuid = payload.contact?.team?.uuid;
  const teamName = payload.contact?.team?.name;
  if (!teamUuid || !teamName) {
    throw new Error("Missing team info");
  }

  const assignedUserEmail = payload.contact?.assignedUser ?? null;
  const caseId = `${conversationHref}::${openedReceivedAtUtc.toISO()}`;

  return prisma.$transaction(async (tx) => {
    const windowStart = DateTime.fromJSDate(openedReceivedDate).minus({ seconds: 60 }).toJSDate();
    const recent = await tx.$queryRaw<{ case_id: string }[]>`
      SELECT case_id
      FROM conversation_cases
      WHERE conversation_href = ${conversationHref}
        AND opened_received_at_utc >= ${windowStart}
      ORDER BY opened_received_at_utc DESC
      LIMIT 1;
    `;

    if (recent.length > 0) {
      return { deduped: true };
    }

    await tx.$executeRaw`
      INSERT INTO conversation_cases (
        case_id,
        conversation_href,
        team_uuid,
        team_name,
        opened_received_at_utc,
        opened_payload_created_at_utc,
        local_date,
        assigned_user_email,
        updated_at
      )
      VALUES (
        ${caseId},
        ${conversationHref},
        ${teamUuid},
        ${teamName},
        ${openedReceivedDate},
        ${openedPayloadCreatedAtDate},
        ${localDate}::date,
        ${assignedUserEmail},
        now()
      );
    `;

    return { inserted: true };
  });
}

export async function handleMessageCreated(payload: MessageCreatedPayload, rawBody: unknown) {
  if (payload.channel !== "whatsapp") {
    return { ignored: true, reason: "non_whatsapp_channel" };
  }
  if (payload.contact?.source && payload.contact.source !== "whatsapp") {
    return { ignored: true, reason: "non_whatsapp_source" };
  }

  // Use createdAt from payload or fall back to now
  const createdAtStr = payload.createdAt || new Date().toISOString();
  const createdAtUtc = DateTime.fromISO(createdAtStr, { zone: "utc" });
  if (!createdAtUtc.isValid) {
    throw new Error("Invalid createdAt timestamp");
  }

  const localDate = computeLocalDate(createdAtUtc);

  const createdAtDate = createdAtUtc.toJSDate();
  
  // Use conversationHref from contact or fall back to contact.href or uuid
  const conversationHref = payload.contact.conversationHref || payload.contact.href || payload.contact.uuid || payload.uuid;
  
  // Extract team info
  const teamUuid = payload.contact.team?.uuid;
  const teamName = payload.contact.team?.name;

  return prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<{ uuid: string }[]>`
      INSERT INTO messages_raw (uuid, conversation_href, status, channel, created_at_utc, payload)
      VALUES (${payload.uuid}, ${conversationHref}, ${payload.status}::"MessageStatus", ${payload.channel}, ${createdAtDate}, ${JSON.stringify(rawBody)}::jsonb)
      ON CONFLICT (uuid) DO NOTHING
      RETURNING uuid;
    `;

    if (inserted.length === 0) {
      return { deduped: true };
    }

    if (payload.status === "received") {
      await tx.$executeRaw`
        INSERT INTO conversation_day_metrics (
          conversation_href,
          local_date,
          first_inbound_at_utc,
          inbound_count_day,
          team_uuid,
          team_name,
          updated_at
        )
        VALUES (${conversationHref}, ${localDate}::date, ${createdAtDate}, 1, ${teamUuid || null}, ${teamName || null}, now())
        ON CONFLICT (conversation_href, local_date) DO UPDATE SET
          inbound_count_day = conversation_day_metrics.inbound_count_day + 1,
          first_inbound_at_utc = CASE
            WHEN conversation_day_metrics.first_inbound_at_utc IS NULL THEN EXCLUDED.first_inbound_at_utc
            ELSE LEAST(conversation_day_metrics.first_inbound_at_utc, EXCLUDED.first_inbound_at_utc)
          END,
          updated_at = now();
      `;
      
      // Update team metrics
      if (teamUuid && teamName) {
        await tx.$executeRaw`
          INSERT INTO team_day_metrics (team_uuid, team_name, local_date, inbound_count, conversations, updated_at)
          VALUES (${teamUuid}, ${teamName}, ${localDate}::date, 1, 1, now())
          ON CONFLICT (team_uuid, local_date) DO UPDATE SET
            inbound_count = team_day_metrics.inbound_count + 1,
            updated_at = now()
            WHERE team_day_metrics.conversations IS NOT NULL;
        `;
      }
    }

    if (payload.status === "sent") {
      await tx.$executeRaw`
        INSERT INTO conversation_day_metrics (
          conversation_href,
          local_date,
          outbound_count_day,
          team_uuid,
          team_name,
          updated_at
        )
        VALUES (${conversationHref}, ${localDate}::date, 1, ${teamUuid || null}, ${teamName || null}, now())
        ON CONFLICT (conversation_href, local_date) DO UPDATE SET
          outbound_count_day = conversation_day_metrics.outbound_count_day + 1,
          first_outbound_after_inbound_at_utc = CASE
            WHEN conversation_day_metrics.first_outbound_after_inbound_at_utc IS NULL
             AND conversation_day_metrics.first_inbound_at_utc IS NOT NULL
             AND ${createdAtDate} > conversation_day_metrics.first_inbound_at_utc
            THEN ${createdAtDate}
            ELSE conversation_day_metrics.first_outbound_after_inbound_at_utc
          END,
          answered_same_day = CASE
            WHEN conversation_day_metrics.first_outbound_after_inbound_at_utc IS NULL
             AND conversation_day_metrics.first_inbound_at_utc IS NOT NULL
             AND ${createdAtDate} > conversation_day_metrics.first_inbound_at_utc
            THEN true
            ELSE conversation_day_metrics.answered_same_day
          END,
          updated_at = now();
      `;
      
      // Update team metrics
      if (teamUuid && teamName) {
        await tx.$executeRaw`
          INSERT INTO team_day_metrics (team_uuid, team_name, local_date, outbound_count, updated_at)
          VALUES (${teamUuid}, ${teamName}, ${localDate}::date, 1, now())
          ON CONFLICT (team_uuid, local_date) DO UPDATE SET
            outbound_count = team_day_metrics.outbound_count + 1,
            answered_count = CASE
              WHEN team_day_metrics.conversations > 0 THEN team_day_metrics.answered_count + 1
              ELSE team_day_metrics.answered_count
            END,
            updated_at = now();
        `;
      }

      await tx.$executeRaw`
        WITH candidate AS (
          SELECT case_id, opened_received_at_utc
          FROM conversation_cases
          WHERE conversation_href = ${conversationHref}
            AND answered = false
            AND opened_received_at_utc <= ${createdAtDate}
          ORDER BY opened_received_at_utc DESC
          LIMIT 1
        )
        UPDATE conversation_cases
        SET first_response_at_utc = ${createdAtDate},
            first_response_seconds = FLOOR(EXTRACT(EPOCH FROM (${createdAtDate} - candidate.opened_received_at_utc))),
            answered = true,
            updated_at = now()
        FROM candidate
        WHERE conversation_cases.case_id = candidate.case_id;
      `;
    }

    return { inserted: true };
  });
}

export async function handleConversationClosed(payload: ConversationClosedPayload, rawBody: unknown) {
  if (payload.source !== "whatsapp") {
    return { ignored: true, reason: "non_whatsapp_source" };
  }

  const conversationHref = payload.href;
  if (!conversationHref) {
    throw new Error("Missing conversation href");
  }

  const closedReceivedAtUtc = DateTime.utc();
  const closedReceivedDate = closedReceivedAtUtc.toJSDate();
  const closedPayloadUtc = payload.closedAt
    ? DateTime.fromISO(payload.closedAt, { zone: "utc" })
    : null;
  const closedPayloadDate = closedPayloadUtc && closedPayloadUtc.isValid ? closedPayloadUtc.toJSDate() : null;

  return prisma.$transaction(async (tx) => {
    const openCase = await tx.$queryRaw<{ case_id: string; opened_received_at_utc: Date }[]>`
      SELECT case_id, opened_received_at_utc
      FROM conversation_cases
      WHERE conversation_href = ${conversationHref}
        AND is_closed = false
      ORDER BY opened_received_at_utc DESC
      LIMIT 1;
    `;

    if (openCase.length === 0) {
      return { ignored: true, reason: "no_open_case" };
    }

    const openedReceivedAt = openCase[0].opened_received_at_utc;

    await tx.$executeRaw`
      UPDATE conversation_cases
      SET is_closed = true,
          closed_received_at_utc = ${closedReceivedDate},
          closed_payload_closed_at_utc = ${closedPayloadDate},
          duration_seconds = FLOOR(EXTRACT(EPOCH FROM (${closedReceivedDate} - ${openedReceivedAt}))),
          updated_at = now()
      WHERE case_id = ${openCase[0].case_id};
    `;

    return { updated: true };
  });
}
