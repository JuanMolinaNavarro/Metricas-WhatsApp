import { Router } from "express";
import { z } from "zod";
import { createUser, deactivateUser, updateUser, listUsers } from "../services/userService.js";

export const usersRouter = Router();

const roleSchema = z.enum(["admin", "supervisor", "sa"]);

const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  rol: roleSchema,
});

const updateUserSchema = z
  .object({
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    nombre: z.string().min(1).optional(),
    apellido: z.string().min(1).optional(),
    rol: roleSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "at_least_one_field_required",
  });

usersRouter.post("/users", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  try {
    const user = await createUser(parsed.data);
    return res.status(201).json({
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      apellido: user.apellido,
      rol: user.rol,
      isActive: user.isActive,
    });
  } catch (error) {
    return res.status(409).json({ error: "username_already_exists" });
  }
});

usersRouter.get("/users", async (_req, res) => {
  const users = await listUsers();
  return res.json(
    users.map((user) => ({
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      apellido: user.apellido,
      rol: user.rol,
      isActive: user.isActive,
    }))
  );
});

usersRouter.put("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "invalid_user_id" });
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  try {
    const user = await updateUser(id, parsed.data);
    return res.json({
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      apellido: user.apellido,
      rol: user.rol,
      isActive: user.isActive,
    });
  } catch (error) {
    return res.status(404).json({ error: "user_not_found" });
  }
});

usersRouter.patch("/users/:id/deactivate", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "invalid_user_id" });
  }

  try {
    const user = await deactivateUser(id);
    return res.json({
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      apellido: user.apellido,
      rol: user.rol,
      isActive: user.isActive,
    });
  } catch (error) {
    return res.status(404).json({ error: "user_not_found" });
  }
});
