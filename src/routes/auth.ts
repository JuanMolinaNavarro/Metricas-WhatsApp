import { Router } from "express";
import { z } from "zod";
import { findUserByCredentials } from "../services/userService.js";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  const user = await findUserByCredentials(
    parsed.data.username,
    parsed.data.password
  );

  if (!user) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  return res.json({
    id: user.id,
    username: user.username,
    nombre: user.nombre,
    apellido: user.apellido,
    rol: user.rol,
    isActive: user.isActive,
  });
});
