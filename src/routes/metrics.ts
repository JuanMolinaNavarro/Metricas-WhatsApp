import { Router } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
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
  getCasosResueltos,
  getCasosAbandonados24h,
  getCasosAbiertos,
  getCasosPendientes,
} from "../services/metricsService.js";

export const metricsRouter = Router();

const rangeSchema = z.object({
  desde: z.string().min(1),
  hasta: z.string().min(1),
});

const optionalString = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "string" && val.trim() === "") return undefined;
  return val;
}, z.string().optional());

const frtSchema = rangeSchema.extend({
  team_uuid: optionalString,
  agent_email: optionalString,
});

const frtSlaSchema = rangeSchema.extend({
  team_uuid: optionalString,
  agent_email: optionalString,
  max_seconds: z.coerce.number().int().positive(),
});

const frtAgentesResumenSchema = rangeSchema.extend({
  team_uuid: optionalString,
});

const frtRankingSchema = rangeSchema.extend({
  team_uuid: optionalString,
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const durationSchema = rangeSchema.extend({
  team_uuid: optionalString,
  agent_email: optionalString,
});

const casosResueltosSchema = rangeSchema.extend({
  team_uuid: optionalString,
  agent_email: optionalString,
});

const casosAbandonadosSchema = rangeSchema.extend({
  team_uuid: optionalString,
  agent_email: optionalString,
  as_of: optionalString,
});

const LOCAL_TZ = "America/Argentina/Tucuman";

function getRecentRange(hours: number) {
  const now = DateTime.now().setZone(LOCAL_TZ);
  const start = now.minus({ hours });
  return { desde: start.toISODate()!, hasta: now.toISODate()! };
}

metricsRouter.get("/metrics/casos-atendidos", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
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
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getCasosAtendidosResumen(
      parsed.data.desde,
      parsed.data.hasta
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/equipos/:teamUuid", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getMetricasPorEquipoDetallado(
      parsed.data.desde,
      parsed.data.hasta,
      req.params.teamUuid
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/equipos", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getMetricasPorEquipo(
      parsed.data.desde,
      parsed.data.hasta
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/tiempo-primera-respuesta", async (req, res) => {
  const parsed = frtSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
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
    console.error("Error in getTiempoPrimeraRespuesta:", error);
    return res
      .status(400)
      .json({
        error: "invalid_date_range",
        originalError: error instanceof Error ? error.message : String(error),
      });
  }
});

metricsRouter.get("/metrics/tiempo-primera-respuesta/sla", async (req, res) => {
  const parsed = frtSlaSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
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

metricsRouter.get(
  "/metrics/tiempo-primera-respuesta/agentes-resumen",
  async (req, res) => {
    const parsed = frtAgentesResumenSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
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
  }
);

metricsRouter.get(
  "/metrics/tiempo-primera-respuesta/ranking-agentes",
  async (req, res) => {
    const parsed = frtRankingSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
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
  }
);

metricsRouter.get("/metrics/duracion-promedio", async (req, res) => {
  const parsed = durationSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
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

metricsRouter.get(
  "/metrics/tiempo-primera-respuesta/resumen-agentes",
  async (req, res) => {
    const parsed = rangeSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    try {
      const data = await getTiempoPrimeraRespuestaResumenAgentes(
        parsed.data.desde,
        parsed.data.hasta
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get(
  "/metrics/tiempo-primera-respuesta/resumen-equipos",
  async (req, res) => {
    const parsed = rangeSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    try {
      const data = await getTiempoPrimeraRespuestaResumenEquipos(
        parsed.data.desde,
        parsed.data.hasta
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get(
  "/metrics/duracion-promedio/resumen-agentes",
  async (req, res) => {
    const parsed = rangeSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    try {
      const data = await getDuracionPromedioResumenAgentes(
        parsed.data.desde,
        parsed.data.hasta
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get(
  "/metrics/duracion-promedio/resumen-equipos",
  async (req, res) => {
    const parsed = rangeSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    try {
      const data = await getDuracionPromedioResumenEquipos(
        parsed.data.desde,
        parsed.data.hasta
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get("/metrics/casos-resueltos", async (req, res) => {
  const parsed = casosResueltosSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getCasosResueltos(
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

metricsRouter.get("/metrics/casos-abandonados-24h", async (req, res) => {
  const parsed = casosAbandonadosSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getCasosAbandonados24h(
      parsed.data.desde,
      parsed.data.hasta,
      parsed.data.team_uuid,
      parsed.data.agent_email,
      parsed.data.as_of
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/casos-pendientes", async (req, res) => {
  const parsed = casosResueltosSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getCasosPendientes(
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

metricsRouter.get("/metrics/casos-atendidos/ultimas-24h", async (_req, res) => {
  const range = getRecentRange(24);
  try {
    const data = await getCasosAtendidos(range.desde, range.hasta);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/casos-atendidos/ultimas-48h", async (_req, res) => {
  const range = getRecentRange(48);
  try {
    const data = await getCasosAtendidos(range.desde, range.hasta);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get(
  "/metrics/casos-atendidos/ultimos-7-dias",
  async (_req, res) => {
    const range = getRecentRange(24 * 7);
    try {
      const data = await getCasosAtendidos(range.desde, range.hasta);
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get("/metrics/casos-abiertos/ultimas-24h", async (req, res) => {
  const parsed = casosResueltosSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  const range = getRecentRange(24);
  try {
    const data = await getCasosAbiertos(
      range.desde,
      range.hasta,
      parsed.data.team_uuid,
      parsed.data.agent_email
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/casos-pendientes/ultimas-24h", async (req, res) => {
  const parsed = casosResueltosSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  const range = getRecentRange(24);
  try {
    const data = await getCasosPendientes(
      range.desde,
      range.hasta,
      parsed.data.team_uuid,
      parsed.data.agent_email
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/casos-abiertos/ultimas-48h", async (req, res) => {
  const parsed = casosResueltosSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  const range = getRecentRange(48);
  try {
    const data = await getCasosAbiertos(
      range.desde,
      range.hasta,
      parsed.data.team_uuid,
      parsed.data.agent_email
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/casos-pendientes/ultimas-48h", async (req, res) => {
  const parsed = casosResueltosSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  const range = getRecentRange(48);
  try {
    const data = await getCasosPendientes(
      range.desde,
      range.hasta,
      parsed.data.team_uuid,
      parsed.data.agent_email
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get(
  "/metrics/casos-abiertos/ultimos-7-dias",
  async (req, res) => {
    const parsed = casosResueltosSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const range = getRecentRange(24 * 7);
    try {
      const data = await getCasosAbiertos(
        range.desde,
        range.hasta,
        parsed.data.team_uuid,
        parsed.data.agent_email
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get(
  "/metrics/casos-pendientes/ultimos-7-dias",
  async (req, res) => {
    const parsed = casosResueltosSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const range = getRecentRange(24 * 7);
    try {
      const data = await getCasosPendientes(
        range.desde,
        range.hasta,
        parsed.data.team_uuid,
        parsed.data.agent_email
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get(
  "/metrics/tiempo-primera-respuesta/ultimas-24h",
  async (req, res) => {
    const parsed = frtSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const range = getRecentRange(24);
    try {
      const data = await getTiempoPrimeraRespuesta(
        range.desde,
        range.hasta,
        parsed.data.team_uuid,
        parsed.data.agent_email
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get(
  "/metrics/tiempo-primera-respuesta/ultimas-48h",
  async (req, res) => {
    const parsed = frtSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const range = getRecentRange(48);
    try {
      const data = await getTiempoPrimeraRespuesta(
        range.desde,
        range.hasta,
        parsed.data.team_uuid,
        parsed.data.agent_email
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get(
  "/metrics/tiempo-primera-respuesta/ultimos-7-dias",
  async (req, res) => {
    const parsed = frtSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const range = getRecentRange(24 * 7);
    try {
      const data = await getTiempoPrimeraRespuesta(
        range.desde,
        range.hasta,
        parsed.data.team_uuid,
        parsed.data.agent_email
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get("/metrics/casos-resueltos/ultimas-24h", async (req, res) => {
  const parsed = casosResueltosSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  const range = getRecentRange(24);
  try {
    const data = await getCasosResueltos(
      range.desde,
      range.hasta,
      parsed.data.team_uuid,
      parsed.data.agent_email
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get("/metrics/casos-resueltos/ultimas-48h", async (req, res) => {
  const parsed = casosResueltosSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  const range = getRecentRange(48);
  try {
    const data = await getCasosResueltos(
      range.desde,
      range.hasta,
      parsed.data.team_uuid,
      parsed.data.agent_email
    );
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

metricsRouter.get(
  "/metrics/casos-resueltos/ultimos-7-dias",
  async (req, res) => {
    const parsed = casosResueltosSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const range = getRecentRange(24 * 7);
    try {
      const data = await getCasosResueltos(
        range.desde,
        range.hasta,
        parsed.data.team_uuid,
        parsed.data.agent_email
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get(
  "/metrics/casos-abandonados-24h/ultimas-24h",
  async (req, res) => {
    const parsed = casosAbandonadosSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const range = getRecentRange(24);
    try {
      const data = await getCasosAbandonados24h(
        range.desde,
        range.hasta,
        parsed.data.team_uuid,
        parsed.data.agent_email,
        parsed.data.as_of
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get(
  "/metrics/casos-abandonados-24h/ultimas-48h",
  async (req, res) => {
    const parsed = casosAbandonadosSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const range = getRecentRange(48);
    try {
      const data = await getCasosAbandonados24h(
        range.desde,
        range.hasta,
        parsed.data.team_uuid,
        parsed.data.agent_email,
        parsed.data.as_of
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);

metricsRouter.get(
  "/metrics/casos-abandonados-24h/ultimos-7-dias",
  async (req, res) => {
    const parsed = casosAbandonadosSchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const range = getRecentRange(24 * 7);
    try {
      const data = await getCasosAbandonados24h(
        range.desde,
        range.hasta,
        parsed.data.team_uuid,
        parsed.data.agent_email,
        parsed.data.as_of
      );
      return res.json(data);
    } catch (error) {
      return res.status(400).json({ error: "invalid_date_range" });
    }
  }
);
