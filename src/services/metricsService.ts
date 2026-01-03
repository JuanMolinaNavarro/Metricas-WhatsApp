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
      SUM(CASE WHEN answered_same_day THEN 1 ELSE 0 END) AS conversaciones_atendidas_same_day,
      ROUND(100.0 * SUM(CASE WHEN answered_same_day THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 2) AS pct_atendidas
    FROM conversation_day_metrics
    WHERE local_date >= ${start}::date AND local_date < ${endExclusive}::date
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
      SUM(CASE WHEN answered_same_day THEN 1 ELSE 0 END) AS conversaciones_atendidas_same_day,
      ROUND(100.0 * SUM(CASE WHEN answered_same_day THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 2) AS pct_atendidas
    FROM conversation_day_metrics
    WHERE local_date >= ${start}::date AND local_date < ${endExclusive}::date;
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
      SUM(CASE WHEN answered_same_day THEN 1 ELSE 0 END) AS conversaciones_atendidas_same_day,
      ROUND(100.0 * SUM(CASE WHEN answered_same_day THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 2) AS pct_atendidas
    FROM conversation_day_metrics
    WHERE local_date >= ${start}::date AND local_date < ${endExclusive}::date
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
      assigned_user_email AS agent_email,
      COUNT(*) AS casos_abiertos,
      SUM(CASE WHEN answered THEN 1 ELSE 0 END) AS casos_respondidos,
      ROUND((AVG(first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS avg_frt_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS median_frt_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS p90_frt_seconds
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
      assigned_user_email AS agent_email,
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
      AND (${agentEmail ?? null}::text IS NULL OR assigned_user_email = ${agentEmail ?? null})
    GROUP BY local_date, team_uuid, team_name, assigned_user_email
    ORDER BY local_date, team_name, assigned_user_email;
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
      assigned_user_email AS agent_email,
      COUNT(*) AS casos_abiertos,
      SUM(CASE WHEN answered THEN 1 ELSE 0 END) AS casos_respondidos,
      ROUND((AVG(first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS avg_frt_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS median_frt_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS p90_frt_seconds
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
      AND (${teamUuid ?? null}::text IS NULL OR team_uuid = ${teamUuid ?? null})
    GROUP BY assigned_user_email
    ORDER BY assigned_user_email;
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
      assigned_user_email AS agent_email,
      COUNT(*) FILTER (WHERE answered) AS casos_respondidos,
      ROUND((AVG(first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS avg_frt_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS median_frt_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS p90_frt_seconds
    FROM conversation_cases
    WHERE local_date >= $1::date
      AND local_date < $2::date
      AND assigned_user_email IS NOT NULL
      AND ($3::text IS NULL OR team_uuid = $3)
    GROUP BY assigned_user_email
    ORDER BY avg_frt_seconds ${orderSql}, assigned_user_email
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
      assigned_user_email AS agent_email,
      COUNT(*) AS casos_abiertos,
      SUM(CASE WHEN answered THEN 1 ELSE 0 END) AS casos_respondidos,
      ROUND((AVG(first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS avg_frt_seconds,
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS median_frt_seconds,
      ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY first_response_seconds) FILTER (WHERE answered))::numeric, 2) AS p90_frt_seconds
    FROM conversation_cases
    WHERE local_date >= ${start}::date
      AND local_date < ${endExclusive}::date
    GROUP BY assigned_user_email
    ORDER BY assigned_user_email;
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
