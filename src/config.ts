import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  WEBHOOK_SECRET: z.string().optional().default(""),
  SA_USERNAME: z.string().min(1),
  SA_PASSWORD: z.string().min(1),
  SA_NOMBRE: z.string().optional().default(""),
  SA_APELLIDO: z.string().optional().default(""),
});

export const env = envSchema.parse(process.env);
