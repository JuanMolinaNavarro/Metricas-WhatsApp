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
  text?: string | null;
  contact: {
    conversationHref?: string;
    href?: string;
    uuid?: string;
    source?: string;
    team?: {
      uuid?: string;
      name?: string;
    };
    assignedUser?: string | null;
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
    assignedUser?: string | null;
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

export type ContactUpdatedPayload = {
  uuid?: string;
  href?: string;
  conversationHref?: string;
  assignedUser?: string | null;
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
  const assignedAtDate = assignedUserEmail ? openedReceivedDate : null;
  const caseId = `${conversationHref}::${openedReceivedAtUtc.toISO()}`;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${conversationHref}));
    `;

    const existingOpenCase = await tx.$queryRaw<{ case_id: string }[]>`
      SELECT case_id
      FROM conversation_cases
      WHERE conversation_href = ${conversationHref}
        AND is_closed = false
      ORDER BY opened_received_at_utc DESC
      LIMIT 1;
    `;

    if (existingOpenCase.length > 0) {
      await tx.$executeRaw`
        UPDATE conversation_cases
        SET team_uuid = ${teamUuid},
            team_name = ${teamName},
            assigned_user_email = ${assignedUserEmail},
            assigned_at_utc = CASE
              WHEN assigned_user_email IS DISTINCT FROM ${assignedUserEmail}
              THEN CASE
                WHEN ${assignedUserEmail}::text IS NULL THEN NULL
                ELSE ${openedReceivedDate}
              END
              ELSE assigned_at_utc
            END,
            updated_at = now()
        WHERE case_id = ${existingOpenCase[0].case_id};
      `;

      return {
        deduped: true,
        reason: "open_case_exists",
        case_id: existingOpenCase[0].case_id,
      };
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
        assigned_at_utc,
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
        ${assignedAtDate},
        now()
      );
    `;

    return { inserted: true, case_id: caseId };
  });
}

export async function handleMessageCreated(payload: MessageCreatedPayload, rawBody: unknown) {
  if (payload.channel !== "whatsapp") {
    return { ignored: true, reason: "non_whatsapp_channel" };
  }
  if (payload.contact?.source && payload.contact.source !== "whatsapp") {
    return { ignored: true, reason: "non_whatsapp_source" };
  }

  // Canonical event time for metrics is always the server receive time.
  const receivedAtUtc = DateTime.utc();
  const receivedAtDate = receivedAtUtc.toJSDate();
  const localDate = computeLocalDate(receivedAtUtc);

  // Keep payload createdAt only as audit metadata.
  const payloadCreatedAtUtc = payload.createdAt
    ? DateTime.fromISO(payload.createdAt, { zone: "utc" })
    : null;
  const payloadCreatedAtDate =
    payloadCreatedAtUtc && payloadCreatedAtUtc.isValid
      ? payloadCreatedAtUtc.toJSDate()
      : null;

  // Use conversationHref from contact or fall back to contact.href or uuid
  const conversationHref = payload.contact.conversationHref || payload.contact.href || payload.contact.uuid || payload.uuid;
  const caseConversationHref = payload.contact.conversationHref || payload.contact.href || payload.contact.uuid || null;
  
  // Extract team info
  const teamUuid = payload.contact.team?.uuid;
  const teamName = payload.contact.team?.name;
  const hasAssignedUser = Object.prototype.hasOwnProperty.call(payload.contact, "assignedUser");
  const assignedUserEmail = payload.contact?.assignedUser ?? null;
  const shouldCountAsAgentResponse = payload.status === "sent" && assignedUserEmail !== null;

  return prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<{ uuid: string }[]>`
      INSERT INTO messages_raw (uuid, conversation_href, status, channel, created_at_utc, payload)
      VALUES (${payload.uuid}, ${conversationHref}, ${payload.status}::"MessageStatus", ${payload.channel}, ${receivedAtDate}, ${JSON.stringify(rawBody)}::jsonb)
      ON CONFLICT (uuid) DO NOTHING
      RETURNING uuid;
    `;

    if (inserted.length === 0) {
      return { deduped: true };
    }

    const lockConversationHref = caseConversationHref || conversationHref || null;
    if (lockConversationHref) {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${lockConversationHref}));
      `;
    }

    if (hasAssignedUser && caseConversationHref) {
      await tx.$executeRaw`
        UPDATE conversation_cases
        SET assigned_user_email = ${assignedUserEmail},
            assigned_at_utc = CASE
              WHEN assigned_user_email IS DISTINCT FROM ${assignedUserEmail}
              THEN CASE
                WHEN ${assignedUserEmail}::text IS NULL THEN NULL
                ELSE ${receivedAtDate}
              END
              ELSE assigned_at_utc
            END,
            updated_at = now()
        WHERE case_id = (
          SELECT case_id
          FROM conversation_cases
          WHERE conversation_href = ${caseConversationHref}
            AND is_closed = false
          ORDER BY opened_received_at_utc DESC
          LIMIT 1
        );
      `;
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
        VALUES (${conversationHref}, ${localDate}::date, ${receivedAtDate}, 1, ${teamUuid || null}, ${teamName || null}, now())
        ON CONFLICT (conversation_href, local_date) DO UPDATE SET
          inbound_count_day = conversation_day_metrics.inbound_count_day + 1,
          first_inbound_at_utc = CASE
            WHEN conversation_day_metrics.first_inbound_at_utc IS NULL THEN EXCLUDED.first_inbound_at_utc
            ELSE LEAST(conversation_day_metrics.first_inbound_at_utc, EXCLUDED.first_inbound_at_utc)
          END,
          updated_at = now();
      `;

      const inferredTeamUuid = teamUuid || "unknown";
      const inferredTeamName = teamName || "Sin equipo asignado";
      const inferredAssignedAtDate = assignedUserEmail ? receivedAtDate : null;
      const inferredCaseId = `${conversationHref}::${receivedAtUtc.toISO()}::inferred`;

      // Guarantee an open case for inbound traffic even if conversation_opened webhook is missing.
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
          assigned_at_utc,
          updated_at
        )
        SELECT
          ${inferredCaseId},
          ${conversationHref},
          ${inferredTeamUuid},
          ${inferredTeamName},
          ${receivedAtDate},
          ${payloadCreatedAtDate},
          ${localDate}::date,
          ${assignedUserEmail},
          ${inferredAssignedAtDate},
          now()
        WHERE NOT EXISTS (
          SELECT 1
          FROM conversation_cases
          WHERE conversation_href = ${conversationHref}
            AND is_closed = false
        );
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
             AND ${receivedAtDate} > conversation_day_metrics.first_inbound_at_utc
            THEN ${receivedAtDate}
            ELSE conversation_day_metrics.first_outbound_after_inbound_at_utc
          END,
          answered_same_day = CASE
            WHEN conversation_day_metrics.first_outbound_after_inbound_at_utc IS NULL
             AND conversation_day_metrics.first_inbound_at_utc IS NOT NULL
             AND ${receivedAtDate} > conversation_day_metrics.first_inbound_at_utc
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

      if (shouldCountAsAgentResponse) {
        await tx.$executeRaw`
          WITH candidate AS (
            SELECT
              case_id,
              opened_received_at_utc AS frt_base_at
            FROM conversation_cases
            WHERE conversation_href = ${conversationHref}
              AND answered = false
              AND opened_received_at_utc <= ${receivedAtDate}
            ORDER BY opened_received_at_utc DESC
            LIMIT 1
          )
          UPDATE conversation_cases
          SET first_response_at_utc = ${receivedAtDate},
              first_response_agent_email = ${assignedUserEmail},
              first_response_seconds = FLOOR(EXTRACT(EPOCH FROM (${receivedAtDate} - candidate.frt_base_at))),
              answered = true,
              updated_at = now()
          FROM candidate
          WHERE conversation_cases.case_id = candidate.case_id;
        `;
      }
    }

    const isReceived = payload.status === "received";
    const isSent = payload.status === "sent";

    await tx.$executeRaw`
      WITH candidate AS (
        SELECT case_id
        FROM conversation_cases
        WHERE conversation_href = ${conversationHref}
          AND opened_received_at_utc <= ${receivedAtDate}
          AND is_closed = false
        ORDER BY opened_received_at_utc DESC
        LIMIT 1
      )
      UPDATE conversation_cases
      SET last_inbound_at_utc = CASE
            WHEN ${isReceived}
             AND (last_inbound_at_utc IS NULL OR ${receivedAtDate} > last_inbound_at_utc)
            THEN ${receivedAtDate}
            ELSE last_inbound_at_utc
          END,
          last_outbound_at_utc = CASE
            WHEN ${isSent}
             AND (last_outbound_at_utc IS NULL OR ${receivedAtDate} > last_outbound_at_utc)
            THEN ${receivedAtDate}
            ELSE last_outbound_at_utc
          END,
          last_message_status = CASE
            WHEN ${isReceived}
             AND (last_inbound_at_utc IS NULL OR ${receivedAtDate} > last_inbound_at_utc)
             AND (last_outbound_at_utc IS NULL OR ${receivedAtDate} > last_outbound_at_utc)
            THEN 'received'::"MessageStatus"
            WHEN ${isSent}
             AND (last_outbound_at_utc IS NULL OR ${receivedAtDate} > last_outbound_at_utc)
             AND (last_inbound_at_utc IS NULL OR ${receivedAtDate} > last_inbound_at_utc)
            THEN 'sent'::"MessageStatus"
            ELSE last_message_status
          END,
          updated_at = now()
      FROM candidate
      WHERE conversation_cases.case_id = candidate.case_id;
    `;

    return { inserted: true };
  });
}

export async function handleContactUpdated(payload: ContactUpdatedPayload, rawBody: unknown) {
  const contact = (payload as any)?.contact ?? payload;
  const conversationHref = contact?.conversationHref || contact?.href || contact?.uuid || null;
  const hasAssignedUser = contact && Object.prototype.hasOwnProperty.call(contact, "assignedUser");
  const assignedUserEmail = contact?.assignedUser ?? null;
  const assignmentUpdatedAtRaw =
    contact?.lastUpdateAt ??
    contact?.updatedAt ??
    (payload as any)?.lastUpdateAt ??
    (payload as any)?.updatedAt ??
    (payload as any)?.createdAt;
  const assignmentUpdatedAt = DateTime.fromISO(assignmentUpdatedAtRaw ?? "", { zone: "utc" });
  const assignmentUpdatedAtDate = assignmentUpdatedAt.isValid ? assignmentUpdatedAt.toJSDate() : new Date();

  if (!conversationHref) {
    return { ignored: true, reason: "missing_conversation_href" };
  }
  if (!hasAssignedUser) {
    return { ignored: true, reason: "missing_assigned_user" };
  }

  await prisma.$executeRaw`
    UPDATE conversation_cases
    SET assigned_user_email = ${assignedUserEmail},
        assigned_at_utc = CASE
          WHEN assigned_user_email IS DISTINCT FROM ${assignedUserEmail}
          THEN CASE
            WHEN ${assignedUserEmail}::text IS NULL THEN NULL
            ELSE ${assignmentUpdatedAtDate}
          END
          ELSE assigned_at_utc
        END,
        updated_at = now()
    WHERE case_id = (
      SELECT case_id
      FROM conversation_cases
      WHERE conversation_href = ${conversationHref}
        AND is_closed = false
      ORDER BY opened_received_at_utc DESC
      LIMIT 1
    );
  `;

  return { updated: true };
}

export async function handleConversationClosed(payload: ConversationClosedPayload, rawBody: unknown) {
  if (payload.source !== "whatsapp") {
    return { ignored: true, reason: "non_whatsapp_source" };
  }

  const conversationHref = payload.href;
  if (!conversationHref) {
    throw new Error("Missing conversation href");
  }

  const contact = payload.contact ?? null;
  const hasAssignedUser = !!contact && Object.prototype.hasOwnProperty.call(contact, "assignedUser");
  const assignedUserEmail = hasAssignedUser ? (contact as any).assignedUser ?? null : null;

  const closedReceivedAtUtc = DateTime.utc();
  const closedReceivedDate = closedReceivedAtUtc.toJSDate();
  const closedPayloadUtc = payload.closedAt
    ? DateTime.fromISO(payload.closedAt, { zone: "utc" })
    : null;
  const closedPayloadDate = closedPayloadUtc && closedPayloadUtc.isValid ? closedPayloadUtc.toJSDate() : null;
  const assignmentAtDate = closedPayloadDate ?? closedReceivedDate;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${conversationHref}));
    `;

    const closedCases = await tx.$queryRaw<{ case_id: string }[]>`
      UPDATE conversation_cases
      SET is_closed = true,
          closed_received_at_utc = ${closedReceivedDate},
          closed_payload_closed_at_utc = ${closedPayloadDate},
          duration_seconds = FLOOR(EXTRACT(EPOCH FROM (${closedReceivedDate} - opened_received_at_utc))),
          assigned_user_email = CASE
            WHEN ${hasAssignedUser} THEN ${assignedUserEmail}
            ELSE assigned_user_email
          END,
          assigned_at_utc = CASE
            WHEN ${hasAssignedUser} AND assigned_user_email IS DISTINCT FROM ${assignedUserEmail}
            THEN CASE
              WHEN ${assignedUserEmail}::text IS NULL THEN NULL
              ELSE ${assignmentAtDate}
            END
            ELSE assigned_at_utc
          END,
          updated_at = now()
      WHERE conversation_href = ${conversationHref}
        AND is_closed = false
      RETURNING case_id;
    `;

    if (closedCases.length === 0) {
      return { ignored: true, reason: "no_open_case" };
    }

    return { updated: true, closed_cases: closedCases.length };
  });
}
