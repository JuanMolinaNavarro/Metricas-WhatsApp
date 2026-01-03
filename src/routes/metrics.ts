import { Router } from "express";
import { z } from "zod";
import {
  getCasosAtendidos,
  getCasosAtendidosResumen,
  getMetricasPorEquipo,
  getMetricasPorEquipoDetallado,
  getTiempoPrimeraRespuesta,
  getTiempoPrimeraRespuestaPorAgente,
  getTiempoPrimeraRespuestaRankingAgentes,
  getTiempoPrimeraRespuestaSla,
  getDuracionPromedio,
  getTiempoPrimeraRespuestaResumenAgentes,
  getTiempoPrimeraRespuestaResumenEquipos,
  getDuracionPromedioResumenAgentes,
  getDuracionPromedioResumenEquipos,
} from "../services/metricsService.js";

export const metricsRouter = Router();

const rangeSchema = z.object({
  desde: z.string().min(1),
  hasta: z.string().min(1),
});

const frtSchema = rangeSchema.extend({
  team_uuid: z.string().optional(),
  agent_email: z.string().optional(),
});

const frtSlaSchema = rangeSchema.extend({
  team_uuid: z.string().optional(),
  agent_email: z.string().optional(),
  max_seconds: z.coerce.number().int().positive(),
});

const frtAgentesResumenSchema = rangeSchema.extend({
  team_uuid: z.string().optional(),
});

const frtRankingSchema = rangeSchema.extend({
  team_uuid: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const durationSchema = rangeSchema.extend({
  team_uuid: z.string().optional(),
  agent_email: z.string().optional(),
});

metricsRouter.get("/metrics/casos-atendidos", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getCasosAtendidos(parsed.data.desde, parsed.data.hasta);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/casos-atendidos/resumen", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getCasosAtendidosResumen(parsed.data.desde, parsed.data.hasta);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/equipos/:teamUuid", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getMetricasPorEquipoDetallado(parsed.data.desde, parsed.data.hasta, req.params.teamUuid);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/equipos", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getMetricasPorEquipo(parsed.data.desde, parsed.data.hasta);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/tiempo-primera-respuesta", async (req, res) => {
  const parsed = frtSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getTiempoPrimeraRespuesta(
      parsed.data.desde,
      parsed.data.hasta,
      parsed.data.team_uuid,
      parsed.data.agent_email
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/tiempo-primera-respuesta/sla", async (req, res) => {
  const parsed = frtSlaSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getTiempoPrimeraRespuestaSla(
      parsed.data.desde,
      parsed.data.hasta,
      parsed.data.max_seconds,
      parsed.data.team_uuid,
      parsed.data.agent_email
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/tiempo-primera-respuesta/agentes-resumen", async (req, res) => {
  const parsed = frtAgentesResumenSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getTiempoPrimeraRespuestaPorAgente(
      parsed.data.desde,
      parsed.data.hasta,
      parsed.data.team_uuid
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/tiempo-primera-respuesta/ranking-agentes", async (req, res) => {
  const parsed = frtRankingSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  const order = parsed.data.order ?? "asc";
  const limit = parsed.data.limit ?? 10;

  try {
    const data = await getTiempoPrimeraRespuestaRankingAgentes(
      parsed.data.desde,
      parsed.data.hasta,
      order,
      limit,
      parsed.data.team_uuid
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/duracion-promedio", async (req, res) => {
  const parsed = durationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getDuracionPromedio(
      parsed.data.desde,
      parsed.data.hasta,
      parsed.data.team_uuid,
      parsed.data.agent_email
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/tiempo-primera-respuesta/resumen-agentes", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getTiempoPrimeraRespuestaResumenAgentes(parsed.data.desde, parsed.data.hasta);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/tiempo-primera-respuesta/resumen-equipos", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getTiempoPrimeraRespuestaResumenEquipos(parsed.data.desde, parsed.data.hasta);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/duracion-promedio/resumen-agentes", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getDuracionPromedioResumenAgentes(parsed.data.desde, parsed.data.hasta);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/duracion-promedio/resumen-equipos", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getDuracionPromedioResumenEquipos(parsed.data.desde, parsed.data.hasta);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});
