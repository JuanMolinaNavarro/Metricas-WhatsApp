import express from "express";
import { createRequire } from "module";
import { env } from "./config.js";
import { healthRouter } from "./routes/health.js";
import { webhookRouter } from "./routes/webhook.js";
import { metricsRouter } from "./routes/metrics.js";
import { usersRouter } from "./routes/users.js";
import { authRouter } from "./routes/auth.js";
import { ensureSaUser } from "./services/userService.js";

const require = createRequire(import.meta.url);
const pinoHttp = require("pino-http");

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(pinoHttp());

app.use(healthRouter);
app.use(webhookRouter);
app.use(metricsRouter);
app.use(usersRouter);
app.use(authRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: "internal_error" });
});

async function start() {
  await ensureSaUser();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on port ${env.PORT}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start API", error);
  process.exit(1);
});
