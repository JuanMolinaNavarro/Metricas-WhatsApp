import { DateTime } from "luxon";
import { prisma } from "../db/prisma.js";

export function parseDateRange(desde: string, hasta: string) {
  // Try parsing as full ISO string first, then as date-only string
  let start = DateTime.fromISO(desde, { zone: "utc" });
  if (!start.isValid) {
    start = DateTime.fromISO(desde + "T00:00:00Z", { zone: "utc" });
  }
  
  let end = DateTime.fromISO(hasta, { zone: "utc" });
  if (!end.isValid) {
    end = DateTime.fromISO(hasta + "T23:59:59Z", { zone: "utc" });
  }

  if (!start.isValid || !end.isValid) {
    throw new Error("Invalid date range");
  }

  if (end < start) {
    throw new Error("Invalid date range");
  }

  const endExclusive = end.plus({ days: 1 });
  return { start: start.toISODate()!, endExclusive: endExclusive.toISODate()! };
}

export async function getCasosAtendidos(desde: string, hasta: string) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      dia: Date;
      conversaciones_entrantes: number;
      conversaciones_atendidas_same_day: number;
      pct_atendidas: number | null;
    }>
  >`
    SELECT
      local_date AS dia,
      COUNT(*) AS conversaciones_entrantes,
      SUM(
        CASE
          WHEN answered
            AND first_response_at_utc IS NOT NULL
            AND ((first_response_at_utc AT TIME ZONE 'America/Argentina/Tucuman')::date = local_date)
          THEN 1 ELSE 0
        END
      ) AS conversaciones_atendidas_same_day,
      ROUND(
        100.0 * SUM(
          CASE
            WHEN answered
              AND first_response_at_utc IS NOT NULL
              AND ((first_response_at_utc AT TIME ZONE 'America/Argentina/Tucuman')::date = local_date)
            THEN 1 ELSE 0
          END
        ) / NULLIF(COUNT(*),0),
        2
      ) AS pct_atendidas
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
    GROUP BY local_date
    ORDER BY local_date;
  `;

  return rows.map((row) => ({
    dia: DateTime.fromJSDate(row.dia).toISODate(),
    conversaciones_entrantes: Number(row.conversaciones_entrantes),
    conversaciones_atendidas_same_day: Number(row.conversaciones_atendidas_same_day),
    pct_atendidas: row.pct_atendidas === null ? 0 : Number(row.pct_atendidas),
  }));
}

export async function getCasosAtendidosResumen(desde: string, hasta: string) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      conversaciones_entrantes: number;
      conversaciones_atendidas_same_day: number;
      pct_atendidas: number | null;
    }>
  >`
    SELECT
      COUNT(*) AS conversaciones_entrantes,
      SUM(
        CASE
          WHEN answered
            AND first_response_at_utc IS NOT NULL
            AND ((first_response_at_utc AT TIME ZONE 'America/Argentina/Tucuman')::date = local_date)
          THEN 1 ELSE 0
        END
      ) AS conversaciones_atendidas_same_day,
      ROUND(
        100.0 * SUM(
          CASE
            WHEN answered
              AND first_response_at_utc IS NOT NULL
              AND ((first_response_at_utc AT TIME ZONE 'America/Argentina/Tucuman')::date = local_date)
            THEN 1 ELSE 0
          END
        ) / NULLIF(COUNT(*),0),
        2
      ) AS pct_atendidas
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date;
  `;

  const row = rows[0] ?? {
    conversaciones_entrantes: 0,
    conversaciones_atendidas_same_day: 0,
    pct_atendidas: 0,
  };

  return {
    conversaciones_entrantes: Number(row.conversaciones_entrantes ?? 0),
    conversaciones_atendidas_same_day: Number(row.conversaciones_atendidas_same_day ?? 0),
    pct_atendidas: row.pct_atendidas === null ? 0 : Number(row.pct_atendidas ?? 0),
  };
}

export async function getMetricasPorEquipo(desde: string, hasta: string) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      team_name: string;
      team_uuid: string;
      local_date: Date;
      conversaciones_entrantes: number;
      conversaciones_atendidas_same_day: number;
      pct_atendidas: number | null;
    }>
  >`
    SELECT
      COALESCE(team_name, 'Sin equipo asignado') AS team_name,
      COALESCE(team_uuid, 'unknown') AS team_uuid,
      local_date,
      COUNT(*) AS conversaciones_entrantes,
      SUM(
        CASE
          WHEN answered
            AND first_response_at_utc IS NOT NULL
            AND ((first_response_at_utc AT TIME ZONE 'America/Argentina/Tucuman')::date = local_date)
          THEN 1 ELSE 0
        END
      ) AS conversaciones_atendidas_same_day,
      ROUND(
        100.0 * SUM(
          CASE
            WHEN answered
              AND first_response_at_utc IS NOT NULL
              AND ((first_response_at_utc AT TIME ZONE 'America/Argentina/Tucuman')::date = local_date)
            THEN 1 ELSE 0
          END
        ) / NULLIF(COUNT(*),0),
        2
      ) AS pct_atendidas
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
    GROUP BY team_uuid, team_name, local_date
    ORDER BY team_name, local_date;
  `;

  return rows.map((row) => ({
    team_name: row.team_name,
    team_uuid: row.team_uuid,
    dia: DateTime.fromJSDate(row.local_date).toISODate(),
    conversaciones_entrantes: Number(row.conversaciones_entrantes),
    conversaciones_atendidas_same_day: Number(row.conversaciones_atendidas_same_day),
    pct_atendidas: row.pct_atendidas === null ? 0 : Number(row.pct_atendidas),
  }));
}

export async function getMetricasPorEquipoDetallado(desde: string, hasta: string, teamUuid: string) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      local_date: Date;
      team_name: string;
      inbound_count: number;
      outbound_count: number;
      answered_count: number;
    }>
  >`
    SELECT
      local_date,
      team_name,
      inbound_count,
      outbound_count,
      answered_count
    FROM team_day_metrics
    WHERE team_uuid = ${teamUuid} AND local_date >= ${start}::date AND local_date < ${endExclusive}::date
    ORDER BY local_date;
  `;

  return rows.map((row) => ({
    fecha: DateTime.fromJSDate(row.local_date).toISODate(),
    team_name: row.team_name,
    inbound_count: Number(row.inbound_count),
    outbound_count: Number(row.outbound_count),
    answered_count: Number(row.answered_count),
  }));
}

export async function getTiempoPrimeraRespuesta(
  desde: string,
  hasta: string,
  teamUuid?: string,
  agentEmail?: string
) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      dia: Date;
      team_uuid: string;
      team_name: string;
      agent_email: string | null;
      casos_abiertos: number;
      casos_respondidos: number;
      avg_frt_seconds: number | null;
      median_frt_seconds: number | null;
      p90_frt_seconds: number | null;
    }>
  >`
    SELECT
      local_date AS dia,
      team_uuid,
      team_name,
      CASE
        WHEN answered THEN COALESCE(first_response_agent_email, assigned_user_email)
        ELSE assigned_user_email
      END AS agent_email,
      COUNT(*) AS casos_abiertos,
      SUM(CASE WHEN answered THEN 1 ELSE 0 END) AS casos_respondidos,
      ROUND((AVG(first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS avg_frt_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS median_frt_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS p90_frt_seconds
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
      AND (${teamUuid ?? null}::text IS NULL OR team_uuid = ${teamUuid ?? null})
      AND (
        ${agentEmail ?? null}::text IS NULL
        OR CASE
             WHEN answered THEN COALESCE(first_response_agent_email, assigned_user_email)
             ELSE assigned_user_email
           END = ${agentEmail ?? null}
      )
    GROUP BY local_date, team_uuid, team_name,
      CASE
        WHEN answered THEN COALESCE(first_response_agent_email, assigned_user_email)
        ELSE assigned_user_email
      END
    ORDER BY local_date, team_name,
      CASE
        WHEN answered THEN COALESCE(first_response_agent_email, assigned_user_email)
        ELSE assigned_user_email
      END;
  `;

  return rows.map((row) => ({
    dia: DateTime.fromJSDate(row.dia).toISODate(),
    team_uuid: row.team_uuid,
    team_name: row.team_name,
    agent_email: row.agent_email,
    casos_abiertos: Number(row.casos_abiertos),
    casos_respondidos: Number(row.casos_respondidos),
    avg_frt_seconds: row.avg_frt_seconds === null ? 0 : Number(row.avg_frt_seconds),
    median_frt_seconds: row.median_frt_seconds === null ? 0 : Number(row.median_frt_seconds),
    p90_frt_seconds: row.p90_frt_seconds === null ? 0 : Number(row.p90_frt_seconds),
  }));
}

export async function getTiempoPrimeraRespuestaSla(
  desde: string,
  hasta: string,
  maxSeconds: number,
  teamUuid?: string,
  agentEmail?: string
) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      dia: Date;
      team_uuid: string;
      team_name: string;
      agent_email: string | null;
      casos_respondidos: number;
      casos_en_sla: number;
      pct_sla: number | null;
    }>
  >`
    SELECT
      local_date AS dia,
      team_uuid,
      team_name,
      CASE
        WHEN answered THEN COALESCE(first_response_agent_email, assigned_user_email)
        ELSE assigned_user_email
      END AS agent_email,
      COUNT(*) FILTER (WHERE answered) AS casos_respondidos,
      SUM(CASE WHEN answered AND first_response_seconds <= ${maxSeconds} THEN 1 ELSE 0 END) AS casos_en_sla,
      ROUND((
        100.0 * SUM(CASE WHEN answered AND first_response_seconds <= ${maxSeconds} THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*) FILTER (WHERE answered), 0)
      )::numeric, 2) AS pct_sla
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
      AND (${teamUuid ?? null}::text IS NULL OR team_uuid = ${teamUuid ?? null})
      AND (
        ${agentEmail ?? null}::text IS NULL
        OR CASE
             WHEN answered THEN COALESCE(first_response_agent_email, assigned_user_email)
             ELSE assigned_user_email
           END = ${agentEmail ?? null}
      )
    GROUP BY local_date, team_uuid, team_name,
      CASE
        WHEN answered THEN COALESCE(first_response_agent_email, assigned_user_email)
        ELSE assigned_user_email
      END
    ORDER BY local_date, team_name,
      CASE
        WHEN answered THEN COALESCE(first_response_agent_email, assigned_user_email)
        ELSE assigned_user_email
      END;
  `;

  return rows.map((row) => ({
    dia: DateTime.fromJSDate(row.dia).toISODate(),
    team_uuid: row.team_uuid,
    team_name: row.team_name,
    agent_email: row.agent_email,
    casos_respondidos: Number(row.casos_respondidos),
    casos_en_sla: Number(row.casos_en_sla),
    pct_sla: row.pct_sla === null ? 0 : Number(row.pct_sla),
  }));
}

export async function getTiempoPrimeraRespuestaPorAgente(
  desde: string,
  hasta: string,
  teamUuid?: string
) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      agent_email: string | null;
      casos_abiertos: number;
      casos_respondidos: number;
      avg_frt_seconds: number | null;
      median_frt_seconds: number | null;
      p90_frt_seconds: number | null;
    }>
  >`
    SELECT
      COALESCE(first_response_agent_email, assigned_user_email) AS agent_email,
      COUNT(*) AS casos_abiertos,
      SUM(CASE WHEN answered THEN 1 ELSE 0 END) AS casos_respondidos,
      ROUND((AVG(first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS avg_frt_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS median_frt_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS p90_frt_seconds
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
      AND (${teamUuid ?? null}::text IS NULL OR team_uuid = ${teamUuid ?? null})
    GROUP BY COALESCE(first_response_agent_email, assigned_user_email)
    ORDER BY COALESCE(first_response_agent_email, assigned_user_email);
  `;

  return rows.map((row) => ({
    agent_email: row.agent_email,
    casos_abiertos: Number(row.casos_abiertos),
    casos_respondidos: Number(row.casos_respondidos),
    avg_frt_seconds: row.avg_frt_seconds === null ? 0 : Number(row.avg_frt_seconds),
    median_frt_seconds: row.median_frt_seconds === null ? 0 : Number(row.median_frt_seconds),
    p90_frt_seconds: row.p90_frt_seconds === null ? 0 : Number(row.p90_frt_seconds),
  }));
}

export async function getTiempoPrimeraRespuestaRankingAgentes(
  desde: string,
  hasta: string,
  order: "asc" | "desc",
  limit: number,
  teamUuid?: string
) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const orderSql = order === "asc" ? "ASC" : "DESC";
  const sql = `
    SELECT
      COALESCE(first_response_agent_email, assigned_user_email) AS agent_email,
      COUNT(*) FILTER (WHERE answered) AS casos_respondidos,
      ROUND((AVG(first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS avg_frt_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS median_frt_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS p90_frt_seconds
    FROM conversation_cases
    WHERE local_date >= $1::date
      AND local_date < $2::date
      AND COALESCE(first_response_agent_email, assigned_user_email) IS NOT NULL
      AND ($3::text IS NULL OR team_uuid = $3)
    GROUP BY COALESCE(first_response_agent_email, assigned_user_email)
    ORDER BY avg_frt_seconds ${orderSql}, COALESCE(first_response_agent_email, assigned_user_email)
    LIMIT $4;
  `;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      agent_email: string;
      casos_respondidos: number;
      avg_frt_seconds: number | null;
      median_frt_seconds: number | null;
      p90_frt_seconds: number | null;
    }>
  >(sql, start, endExclusive, teamUuid ?? null, limit);

  return rows.map((row) => ({
    agent_email: row.agent_email,
    casos_respondidos: Number(row.casos_respondidos),
    avg_frt_seconds: row.avg_frt_seconds === null ? 0 : Number(row.avg_frt_seconds),
    median_frt_seconds: row.median_frt_seconds === null ? 0 : Number(row.median_frt_seconds),
    p90_frt_seconds: row.p90_frt_seconds === null ? 0 : Number(row.p90_frt_seconds),
  }));
}

export async function getRankingAgentesCompuesto(
  desde: string,
  hasta: string,
  maxSeconds: number,
  limit: number,
  teamUuid?: string,
  asOf?: string
) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const asOfUtc = asOf ? DateTime.fromISO(asOf, { zone: "utc" }) : null;
  if (asOf && !asOfUtc?.isValid) {
    throw new Error("Invalid as_of");
  }

  const rows = await prisma.$queryRaw<
    Array<{
      agent_email: string;
      casos_respondidos: number;
      casos_en_sla: number;
      pct_sla: number | null;
      casos_abiertos_resueltos: number;
      casos_resueltos: number;
      pct_resueltos: number | null;
      casos_abiertos_abandonados: number;
      casos_abandonados_24h: number;
      pct_abandonados_24h: number | null;
      score_abandonos_invertido: number | null;
      puntos_cumplimiento_atencion: number | null;
      puntos_resolucion_efectiva: number | null;
      puntos_abandonos: number | null;
      score_final: number | null;
    }>
  >`
    WITH params AS (
      SELECT COALESCE(${asOfUtc?.toJSDate() ?? null}::timestamptz, now()) AS as_of
    ),
    sla AS (
      SELECT
        CASE
          WHEN answered THEN COALESCE(first_response_agent_email, assigned_user_email)
          ELSE assigned_user_email
        END AS agent_email,
        COUNT(*) FILTER (WHERE answered) AS casos_respondidos,
        SUM(CASE WHEN answered AND first_response_seconds <= ${maxSeconds} THEN 1 ELSE 0 END) AS casos_en_sla,
        ROUND((
          100.0 * SUM(CASE WHEN answered AND first_response_seconds <= ${maxSeconds} THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*) FILTER (WHERE answered), 0)
        )::numeric, 2) AS pct_sla
      FROM conversation_cases
      WHERE local_date >= ${start}::date
        AND local_date < ${endExclusive}::date
        AND (${teamUuid ?? null}::text IS NULL OR team_uuid = ${teamUuid ?? null})
      GROUP BY
        CASE
          WHEN answered THEN COALESCE(first_response_agent_email, assigned_user_email)
          ELSE assigned_user_email
        END
    ),
    resueltos AS (
      SELECT
        assigned_user_email AS agent_email,
        COUNT(*) AS casos_abiertos_resueltos,
        SUM(CASE WHEN is_closed THEN 1 ELSE 0 END) AS casos_resueltos,
        ROUND((
          100.0 * SUM(CASE WHEN is_closed THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0)
        )::numeric, 2) AS pct_resueltos
      FROM conversation_cases
      WHERE local_date >= ${start}::date
        AND local_date < ${endExclusive}::date
        AND (${teamUuid ?? null}::text IS NULL OR team_uuid = ${teamUuid ?? null})
      GROUP BY assigned_user_email
    ),
    abandonados AS (
      SELECT
        c.assigned_user_email AS agent_email,
        COUNT(*) FILTER (WHERE c.is_closed = false) AS casos_abiertos_abandonados,
        SUM(
          CASE
            WHEN c.is_closed = false
              AND c.last_message_status = 'received'
              AND c.last_inbound_at_utc IS NOT NULL
              AND (SELECT as_of FROM params) >= c.last_inbound_at_utc + interval '24 hours'
            THEN 1
            ELSE 0
          END
        ) AS casos_abandonados_24h,
        ROUND((
          100.0 * SUM(
            CASE
              WHEN c.is_closed = false
                AND c.last_message_status = 'received'
                AND c.last_inbound_at_utc IS NOT NULL
                AND (SELECT as_of FROM params) >= c.last_inbound_at_utc + interval '24 hours'
              THEN 1
              ELSE 0
            END
          ) / NULLIF(COUNT(*), 0)
        )::numeric, 2) AS pct_abandonados_24h
      FROM conversation_cases c
      WHERE c.local_date >= ${start}::date
        AND c.local_date < ${endExclusive}::date
        AND (${teamUuid ?? null}::text IS NULL OR c.team_uuid = ${teamUuid ?? null})
      GROUP BY c.assigned_user_email
    ),
    merged AS (
      SELECT
        COALESCE(s.agent_email, r.agent_email, a.agent_email) AS agent_email,
        COALESCE(s.casos_respondidos, 0) AS casos_respondidos,
        COALESCE(s.casos_en_sla, 0) AS casos_en_sla,
        COALESCE(s.pct_sla, 0) AS pct_sla,
        COALESCE(r.casos_abiertos_resueltos, 0) AS casos_abiertos_resueltos,
        COALESCE(r.casos_resueltos, 0) AS casos_resueltos,
        COALESCE(r.pct_resueltos, 0) AS pct_resueltos,
        COALESCE(a.casos_abiertos_abandonados, 0) AS casos_abiertos_abandonados,
        COALESCE(a.casos_abandonados_24h, 0) AS casos_abandonados_24h,
        COALESCE(a.pct_abandonados_24h, 0) AS pct_abandonados_24h
      FROM sla s
      FULL OUTER JOIN resueltos r
        ON r.agent_email = s.agent_email
      FULL OUTER JOIN abandonados a
        ON a.agent_email = COALESCE(s.agent_email, r.agent_email)
    )
    SELECT
      agent_email,
      casos_respondidos,
      casos_en_sla,
      ROUND(pct_sla::numeric, 2) AS pct_sla,
      casos_abiertos_resueltos,
      casos_resueltos,
      ROUND(pct_resueltos::numeric, 2) AS pct_resueltos,
      casos_abiertos_abandonados,
      casos_abandonados_24h,
      ROUND(pct_abandonados_24h::numeric, 2) AS pct_abandonados_24h,
      ROUND((GREATEST(0, LEAST(100, 100 - pct_abandonados_24h)))::numeric, 2) AS score_abandonos_invertido,
      ROUND((pct_sla * 0.35)::numeric, 2) AS puntos_cumplimiento_atencion,
      ROUND((pct_resueltos * 0.25)::numeric, 2) AS puntos_resolucion_efectiva,
      ROUND((GREATEST(0, LEAST(100, 100 - pct_abandonados_24h)) * 0.20)::numeric, 2) AS puntos_abandonos,
      ROUND((
        (pct_sla * 0.35)
        + (pct_resueltos * 0.25)
        + (GREATEST(0, LEAST(100, 100 - pct_abandonados_24h)) * 0.20)
      )::numeric, 2) AS score_final
    FROM merged
    WHERE agent_email IS NOT NULL
    ORDER BY score_final DESC, agent_email
    LIMIT ${limit};
  `;

  return rows.map((row) => ({
    agent_email: row.agent_email,
    casos_respondidos: Number(row.casos_respondidos),
    casos_en_sla: Number(row.casos_en_sla),
    pct_sla: row.pct_sla === null ? 0 : Number(row.pct_sla),
    casos_abiertos_resueltos: Number(row.casos_abiertos_resueltos),
    casos_resueltos: Number(row.casos_resueltos),
    pct_resueltos: row.pct_resueltos === null ? 0 : Number(row.pct_resueltos),
    casos_abiertos_abandonados: Number(row.casos_abiertos_abandonados),
    casos_abandonados_24h: Number(row.casos_abandonados_24h),
    pct_abandonados_24h:
      row.pct_abandonados_24h === null ? 0 : Number(row.pct_abandonados_24h),
    score_abandonos_invertido:
      row.score_abandonos_invertido === null
        ? 0
        : Number(row.score_abandonos_invertido),
    puntos_cumplimiento_atencion:
      row.puntos_cumplimiento_atencion === null
        ? 0
        : Number(row.puntos_cumplimiento_atencion),
    puntos_resolucion_efectiva:
      row.puntos_resolucion_efectiva === null
        ? 0
        : Number(row.puntos_resolucion_efectiva),
    puntos_abandonos:
      row.puntos_abandonos === null ? 0 : Number(row.puntos_abandonos),
    score_final: row.score_final === null ? 0 : Number(row.score_final),
  }));
}

export async function getDuracionPromedio(
  desde: string,
  hasta: string,
  teamUuid?: string,
  agentEmail?: string
) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      dia: Date;
      team_uuid: string;
      team_name: string;
      agent_email: string | null;
      conversaciones_cerradas: number;
      avg_duration_seconds: number | null;
      median_duration_seconds: number | null;
      p90_duration_seconds: number | null;
    }>
  >`
    SELECT
      local_date AS dia,
      team_uuid,
      team_name,
      assigned_user_email AS agent_email,
      COUNT(*) FILTER (WHERE is_closed) AS conversaciones_cerradas,
      ROUND((AVG(duration_seconds) FILTER (WHERE is_closed))::numeric, 2) AS avg_duration_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_seconds) FILTER (WHERE is_closed))::numeric, 2) AS median_duration_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_seconds) FILTER (WHERE is_closed))::numeric, 2) AS p90_duration_seconds
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
      AND (${teamUuid ?? null}::text IS NULL OR team_uuid = ${teamUuid ?? null})
      AND (${agentEmail ?? null}::text IS NULL OR assigned_user_email = ${agentEmail ?? null})
    GROUP BY local_date, team_uuid, team_name, assigned_user_email
    ORDER BY local_date, team_name, assigned_user_email;
  `;

  return rows.map((row) => ({
    dia: DateTime.fromJSDate(row.dia).toISODate(),
    team_uuid: row.team_uuid,
    team_name: row.team_name,
    agent_email: row.agent_email,
    conversaciones_cerradas: Number(row.conversaciones_cerradas),
    avg_duration_seconds: row.avg_duration_seconds === null ? 0 : Number(row.avg_duration_seconds),
    median_duration_seconds: row.median_duration_seconds === null ? 0 : Number(row.median_duration_seconds),
    p90_duration_seconds: row.p90_duration_seconds === null ? 0 : Number(row.p90_duration_seconds),
  }));
}

export async function getTiempoPrimeraRespuestaResumenAgentes(desde: string, hasta: string) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      agent_email: string | null;
      casos_abiertos: number;
      casos_respondidos: number;
      avg_frt_seconds: number | null;
      median_frt_seconds: number | null;
      p90_frt_seconds: number | null;
    }>
  >`
    SELECT
      COALESCE(first_response_agent_email, assigned_user_email) AS agent_email,
      COUNT(*) AS casos_abiertos,
      SUM(CASE WHEN answered THEN 1 ELSE 0 END) AS casos_respondidos,
      ROUND((AVG(first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS avg_frt_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS median_frt_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS p90_frt_seconds
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
    GROUP BY COALESCE(first_response_agent_email, assigned_user_email)
    ORDER BY COALESCE(first_response_agent_email, assigned_user_email);
  `;

  return rows.map((row) => ({
    agent_email: row.agent_email,
    casos_abiertos: Number(row.casos_abiertos),
    casos_respondidos: Number(row.casos_respondidos),
    avg_frt_seconds: row.avg_frt_seconds === null ? 0 : Number(row.avg_frt_seconds),
    median_frt_seconds: row.median_frt_seconds === null ? 0 : Number(row.median_frt_seconds),
    p90_frt_seconds: row.p90_frt_seconds === null ? 0 : Number(row.p90_frt_seconds),
  }));
}

export async function getTiempoPrimeraRespuestaResumenEquipos(desde: string, hasta: string) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      team_uuid: string;
      team_name: string;
      casos_abiertos: number;
      casos_respondidos: number;
      avg_frt_seconds: number | null;
      median_frt_seconds: number | null;
      p90_frt_seconds: number | null;
    }>
  >`
    SELECT
      team_uuid,
      team_name,
      COUNT(*) AS casos_abiertos,
      SUM(CASE WHEN answered THEN 1 ELSE 0 END) AS casos_respondidos,
      ROUND((AVG(first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS avg_frt_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS median_frt_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS p90_frt_seconds
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
    GROUP BY team_uuid, team_name
    ORDER BY team_name;
  `;

  return rows.map((row) => ({
    team_uuid: row.team_uuid,
    team_name: row.team_name,
    casos_abiertos: Number(row.casos_abiertos),
    casos_respondidos: Number(row.casos_respondidos),
    avg_frt_seconds: row.avg_frt_seconds === null ? 0 : Number(row.avg_frt_seconds),
    median_frt_seconds: row.median_frt_seconds === null ? 0 : Number(row.median_frt_seconds),
    p90_frt_seconds: row.p90_frt_seconds === null ? 0 : Number(row.p90_frt_seconds),
  }));
}

export async function getDuracionPromedioResumenAgentes(desde: string, hasta: string) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      agent_email: string | null;
      conversaciones_cerradas: number;
      avg_duration_seconds: number | null;
      median_duration_seconds: number | null;
      p90_duration_seconds: number | null;
    }>
  >`
    SELECT
      assigned_user_email AS agent_email,
      COUNT(*) FILTER (WHERE is_closed) AS conversaciones_cerradas,
      ROUND((AVG(duration_seconds) FILTER (WHERE is_closed))::numeric, 2) AS avg_duration_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_seconds) FILTER (WHERE is_closed))::numeric, 2) AS median_duration_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_seconds) FILTER (WHERE is_closed))::numeric, 2) AS p90_duration_seconds
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
    GROUP BY assigned_user_email
    ORDER BY assigned_user_email;
  `;

  return rows.map((row) => ({
    agent_email: row.agent_email,
    conversaciones_cerradas: Number(row.conversaciones_cerradas),
    avg_duration_seconds: row.avg_duration_seconds === null ? 0 : Number(row.avg_duration_seconds),
    median_duration_seconds: row.median_duration_seconds === null ? 0 : Number(row.median_duration_seconds),
    p90_duration_seconds: row.p90_duration_seconds === null ? 0 : Number(row.p90_duration_seconds),
  }));
}

export async function getDuracionPromedioResumenEquipos(desde: string, hasta: string) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      team_uuid: string;
      team_name: string;
      conversaciones_cerradas: number;
      avg_duration_seconds: number | null;
      median_duration_seconds: number | null;
      p90_duration_seconds: number | null;
    }>
  >`
    SELECT
      team_uuid,
      team_name,
      COUNT(*) FILTER (WHERE is_closed) AS conversaciones_cerradas,
      ROUND((AVG(duration_seconds) FILTER (WHERE is_closed))::numeric, 2) AS avg_duration_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_seconds) FILTER (WHERE is_closed))::numeric, 2) AS median_duration_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_seconds) FILTER (WHERE is_closed))::numeric, 2) AS p90_duration_seconds
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
    GROUP BY team_uuid, team_name
    ORDER BY team_name;
  `;

  return rows.map((row) => ({
    team_uuid: row.team_uuid,
    team_name: row.team_name,
    conversaciones_cerradas: Number(row.conversaciones_cerradas),
    avg_duration_seconds: row.avg_duration_seconds === null ? 0 : Number(row.avg_duration_seconds),
    median_duration_seconds: row.median_duration_seconds === null ? 0 : Number(row.median_duration_seconds),
    p90_duration_seconds: row.p90_duration_seconds === null ? 0 : Number(row.p90_duration_seconds),
  }));
}

export async function getCasosResueltos(
  desde: string,
  hasta: string,
  teamUuid?: string,
  agentEmail?: string
) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      dia: Date;
      team_uuid: string;
      team_name: string;
      agent_email: string | null;
      casos_abiertos: number;
      casos_resueltos: number;
      pct_resueltos: number | null;
    }>
  >`
    SELECT
      local_date AS dia,
      team_uuid,
      team_name,
      assigned_user_email AS agent_email,
      COUNT(*) AS casos_abiertos,
      SUM(CASE WHEN is_closed THEN 1 ELSE 0 END) AS casos_resueltos,
      ROUND((
        100.0 * SUM(CASE WHEN is_closed THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*),0)
      )::numeric, 2) AS pct_resueltos
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
      AND (${teamUuid ?? null}::text IS NULL OR team_uuid = ${teamUuid ?? null})
      AND (${agentEmail ?? null}::text IS NULL OR assigned_user_email = ${agentEmail ?? null})
    GROUP BY local_date, team_uuid, team_name, assigned_user_email
    ORDER BY local_date, team_name, assigned_user_email;
  `;

  return rows.map((row) => ({
    dia: DateTime.fromJSDate(row.dia).toISODate(),
    team_uuid: row.team_uuid,
    team_name: row.team_name,
    agent_email: row.agent_email,
    casos_abiertos: Number(row.casos_abiertos),
    casos_resueltos: Number(row.casos_resueltos),
    pct_resueltos: row.pct_resueltos === null ? 0 : Number(row.pct_resueltos),
  }));
}

export async function getCasosCerradosMismoDia(
  desde: string,
  hasta: string,
  teamUuid?: string,
  agentEmail?: string
) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      dia: Date;
      team_uuid: string;
      team_name: string;
      agent_email: string | null;
      casos_abiertos: number;
      casos_cerrados_mismo_dia: number;
      pct_cerrados_mismo_dia: number | null;
    }>
  >`
    SELECT
      local_date AS dia,
      team_uuid,
      team_name,
      assigned_user_email AS agent_email,
      COUNT(*) AS casos_abiertos,
      SUM(
        CASE
          WHEN is_closed
            AND closed_received_at_utc IS NOT NULL
            AND (closed_received_at_utc AT TIME ZONE 'America/Argentina/Tucuman')::date = local_date
          THEN 1 ELSE 0
        END
      ) AS casos_cerrados_mismo_dia,
      ROUND((
        100.0 * SUM(
          CASE
            WHEN is_closed
              AND closed_received_at_utc IS NOT NULL
              AND (closed_received_at_utc AT TIME ZONE 'America/Argentina/Tucuman')::date = local_date
            THEN 1 ELSE 0
          END
        ) / NULLIF(COUNT(*), 0)
      )::numeric, 2) AS pct_cerrados_mismo_dia
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
      AND (${teamUuid ?? null}::text IS NULL OR team_uuid = ${teamUuid ?? null})
      AND (${agentEmail ?? null}::text IS NULL OR assigned_user_email = ${agentEmail ?? null})
    GROUP BY local_date, team_uuid, team_name, assigned_user_email
    ORDER BY local_date, team_name, assigned_user_email;
  `;

  return rows.map((row) => ({
    dia: DateTime.fromJSDate(row.dia).toISODate(),
    team_uuid: row.team_uuid,
    team_name: row.team_name,
    agent_email: row.agent_email,
    casos_abiertos: Number(row.casos_abiertos),
    casos_cerrados_mismo_dia: Number(row.casos_cerrados_mismo_dia),
    pct_cerrados_mismo_dia:
      row.pct_cerrados_mismo_dia === null
        ? 0
        : Number(row.pct_cerrados_mismo_dia),
  }));
}

export async function getCasosAbandonados24h(
  desde: string,
  hasta: string,
  teamUuid?: string,
  agentEmail?: string,
  asOf?: string
) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const asOfUtc = asOf
    ? DateTime.fromISO(asOf, { zone: "utc" })
    : null;
  if (asOf && !asOfUtc?.isValid) {
    throw new Error("Invalid as_of");
  }

  const rows = await prisma.$queryRaw<
    Array<{
      dia: Date;
      team_uuid: string;
      team_name: string;
      agent_email: string | null;
      casos_abiertos: number;
      casos_abandonados_24h: number;
      pct_abandonados_24h: number | null;
    }>
  >`
    WITH params AS (
      SELECT COALESCE(${asOfUtc?.toJSDate() ?? null}::timestamptz, now()) AS as_of
    )
    SELECT
      c.local_date AS dia,
      c.team_uuid,
      c.team_name,
      c.assigned_user_email AS agent_email,
      COUNT(*) AS casos_abiertos,
      SUM(
        CASE WHEN c.last_message_status = 'received'
          AND c.last_inbound_at_utc IS NOT NULL
          AND (SELECT as_of FROM params) >= c.last_inbound_at_utc + interval '24 hours'
        THEN 1 ELSE 0 END
      ) AS casos_abandonados_24h,
      ROUND((
        100.0 * SUM(
          CASE WHEN c.last_message_status = 'received'
            AND c.last_inbound_at_utc IS NOT NULL
            AND (SELECT as_of FROM params) >= c.last_inbound_at_utc + interval '24 hours'
          THEN 1 ELSE 0 END
        ) / NULLIF(COUNT(*),0)
      )::numeric, 2) AS pct_abandonados_24h
    FROM conversation_cases c
    WHERE c.is_closed = false
      AND c.local_date < ${endExclusive}::date
      AND (${teamUuid ?? null}::text IS NULL OR c.team_uuid = ${teamUuid ?? null})
      AND (${agentEmail ?? null}::text IS NULL OR c.assigned_user_email = ${agentEmail ?? null})
      AND (
        c.local_date >= ${start}::date
        OR (
          c.last_message_status = 'received'
          AND c.last_inbound_at_utc IS NOT NULL
          AND (SELECT as_of FROM params) >= c.last_inbound_at_utc + interval '24 hours'
        )
      )
    GROUP BY c.local_date, c.team_uuid, c.team_name, c.assigned_user_email
    ORDER BY c.local_date, c.team_name, c.assigned_user_email;
  `;

  return rows.map((row) => ({
    dia: DateTime.fromJSDate(row.dia).toISODate(),
    team_uuid: row.team_uuid,
    team_name: row.team_name,
    agent_email: row.agent_email,
    casos_abiertos: Number(row.casos_abiertos),
    casos_abandonados_24h: Number(row.casos_abandonados_24h),
    pct_abandonados_24h: row.pct_abandonados_24h === null ? 0 : Number(row.pct_abandonados_24h),
  }));
}

export async function getCasosPendientes(
  desde: string,
  hasta: string,
  teamUuid?: string,
  agentEmail?: string
) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      dia: Date;
      team_uuid: string;
      team_name: string;
      agent_email: string | null;
      casos_pendientes: number;
    }>
  >`
    SELECT
      local_date AS dia,
      team_uuid,
      team_name,
      assigned_user_email AS agent_email,
      COUNT(*) AS casos_pendientes
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
      AND is_closed = false
      AND (${teamUuid ?? null}::text IS NULL OR team_uuid = ${teamUuid ?? null})
      AND (${agentEmail ?? null}::text IS NULL OR assigned_user_email = ${agentEmail ?? null})
    GROUP BY local_date, team_uuid, team_name, assigned_user_email
    ORDER BY local_date, team_name, assigned_user_email;
  `;

  return rows.map((row) => ({
    dia: DateTime.fromJSDate(row.dia).toISODate(),
    team_uuid: row.team_uuid,
    team_name: row.team_name,
    agent_email: row.agent_email,
    casos_pendientes: Number(row.casos_pendientes),
  }));
}


export async function getCasosAbiertos(
  desde: string,
  hasta: string,
  teamUuid?: string,
  agentEmail?: string
) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      dia: Date;
      team_uuid: string;
      team_name: string;
      agent_email: string | null;
      casos_abiertos: number;
    }>
  >`
    SELECT
      local_date AS dia,
      team_uuid,
      team_name,
      assigned_user_email AS agent_email,
      COUNT(*) AS casos_abiertos
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
      AND (${teamUuid ?? null}::text IS NULL OR team_uuid = ${teamUuid ?? null})
      AND (${agentEmail ?? null}::text IS NULL OR assigned_user_email = ${agentEmail ?? null})
    GROUP BY local_date, team_uuid, team_name, assigned_user_email
    ORDER BY local_date, team_name, assigned_user_email;
  `;

  return rows.map((row) => ({
    dia: DateTime.fromJSDate(row.dia).toISODate(),
    team_uuid: row.team_uuid,
    team_name: row.team_name,
    agent_email: row.agent_email,
    casos_abiertos: Number(row.casos_abiertos),
  }));
}

export async function getHorariosContactoUltimos7Dias() {
  const rows = await prisma.$queryRaw<
    Array<{
      hora_del_dia: number;
      hora: string;
      conversaciones_abiertas: number;
      pct_total: number | null;
      ranking_popularidad: number;
    }>
  >`
    WITH base AS (
      SELECT
        EXTRACT(
          HOUR FROM (
            COALESCE(opened_received_at_utc, opened_payload_created_at_utc)
            AT TIME ZONE 'America/Argentina/Tucuman'
          )
        )::int AS hora_del_dia
      FROM conversation_cases
      WHERE COALESCE(opened_received_at_utc, opened_payload_created_at_utc) >= now() - interval '7 days'
    ),
    horas AS (
      SELECT generate_series(0, 23)::int AS hora_del_dia
    ),
    agregadas AS (
      SELECT
        h.hora_del_dia,
        TO_CHAR(make_time(h.hora_del_dia, 0, 0), 'HH24:MI') AS hora,
        COALESCE(COUNT(b.hora_del_dia), 0)::int AS conversaciones_abiertas
      FROM horas h
      LEFT JOIN base b ON b.hora_del_dia = h.hora_del_dia
      GROUP BY h.hora_del_dia
    ),
    totales AS (
      SELECT SUM(conversaciones_abiertas)::int AS total_conversaciones
      FROM agregadas
    )
    SELECT
      a.hora_del_dia,
      a.hora,
      a.conversaciones_abiertas,
      ROUND((
        100.0 * a.conversaciones_abiertas
        / NULLIF(t.total_conversaciones, 0)
      )::numeric, 2) AS pct_total,
      DENSE_RANK() OVER (ORDER BY a.conversaciones_abiertas DESC) AS ranking_popularidad
    FROM agregadas a
    CROSS JOIN totales t
    ORDER BY a.hora_del_dia;
  `;

  return rows.map((row) => ({
    hora_del_dia: Number(row.hora_del_dia),
    hora: row.hora,
    conversaciones_abiertas: Number(row.conversaciones_abiertas),
    pct_total: row.pct_total === null ? 0 : Number(row.pct_total),
    ranking_popularidad: Number(row.ranking_popularidad),
  }));
}

export async function getEventos(desde: string, hasta: string) {
  const { start, endExclusive } = parseDateRange(desde, hasta);

  const rows = await prisma.$queryRaw<
    Array<{
      id: number;
      fecha: Date;
      titulo: string;
      descripcion: string | null;
      color: string;
      unidad: string | null;
    }>
  >`
    SELECT id, fecha, titulo, descripcion, color, unidad
    FROM evento_metrica
    WHERE fecha >= ${start}::date
      AND fecha < ${endExclusive}::date
    ORDER BY fecha, id;
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    fecha: DateTime.fromJSDate(row.fecha).toISODate(),
    titulo: row.titulo,
    descripcion: row.descripcion ?? null,
    color: row.color,
    unidad: row.unidad ?? null,
  }));
}

export async function createEvento(
  fecha: string,
  titulo: string,
  descripcion?: string,
  color?: string,
  unidad?: string
) {
  const parsed = DateTime.fromISO(fecha, { zone: "utc" });
  if (!parsed.isValid) throw new Error("Invalid fecha");

  const row = await prisma.evento_metrica.create({
    data: {
      fecha: new Date(fecha),
      titulo,
      descripcion: descripcion ?? null,
      color: color ?? "#EF553B",
      unidad: unidad ?? null,
    },
  });

  return {
    id: row.id,
    fecha: DateTime.fromJSDate(row.fecha).toISODate(),
    titulo: row.titulo,
    descripcion: row.descripcion ?? null,
    color: row.color,
    unidad: row.unidad ?? null,
  };
}

export async function deleteEvento(id: number) {
  await prisma.evento_metrica.delete({ where: { id } });
}
