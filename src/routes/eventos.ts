import { Router } from "express";
import { z } from "zod";
import {
  getEventos,
  createEvento,
  updateEvento,
  deleteEvento,
} from "../services/metricsService.js";

export const eventosRouter = Router();

const rangeSchema = z.object({
  desde: z.string().min(1),
  hasta: z.string().min(1),
});

const createSchema = z.object({
  fecha: z.string().min(1),
  titulo: z.string().min(1).max(120),
  descripcion: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  unidad: z.string().max(120).optional(),
  afectados: z.number().int().positive().optional(),
  tipo: z.string().max(80).optional(),
  creado_por: z.string().max(120).optional(),
  zona: z.string().max(120).optional(),
  desdeHora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM (24h)").optional(),
  hastaHora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM (24h)").optional(),
});

const updateSchema = z.object({
  fecha: z.string().min(1).optional(),
  titulo: z.string().min(1).max(120).optional(),
  descripcion: z.string().max(500).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  unidad: z.string().max(120).nullable().optional(),
  afectados: z.number().int().positive().nullable().optional(),
  tipo: z.string().max(80).nullable().optional(),
  creado_por: z.string().max(120).nullable().optional(),
  zona: z.string().max(120).nullable().optional(),
  desdeHora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM (24h)").nullable().optional(),
  hastaHora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM (24h)").nullable().optional(),
});

eventosRouter.get("/metrics/eventos", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_query", details: parsed.error.flatten() });
  }

  try {
    const data = await getEventos(parsed.data.desde, parsed.data.hasta);
    return res.json(data);
  } catch {
    return res.status(400).json({ error: "invalid_date_range" });
  }
});

eventosRouter.post("/metrics/eventos", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  try {
    const evento = await createEvento(
      parsed.data.fecha,
      parsed.data.titulo,
      parsed.data.descripcion,
      parsed.data.color,
      parsed.data.unidad,
      parsed.data.afectados,
      parsed.data.tipo,
      parsed.data.creado_por,
      parsed.data.zona,
      parsed.data.desdeHora,
      parsed.data.hastaHora
    );
    return res.status(201).json(evento);
  } catch (err) {
    return res
      .status(400)
      .json({ error: "invalid_fecha", message: err instanceof Error ? err.message : String(err) });
  }
});

eventosRouter.put("/metrics/eventos/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "invalid_id" });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  try {
    const evento = await updateEvento(id, parsed.data);
    return res.status(200).json(evento);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Record to update not found")) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.status(400).json({ error: "invalid_data", message: msg });
  }
});

eventosRouter.delete("/metrics/eventos/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "invalid_id" });
  }

  try {
    await deleteEvento(id);
    return res.status(204).send();
  } catch {
    return res.status(404).json({ error: "not_found" });
  }
});
