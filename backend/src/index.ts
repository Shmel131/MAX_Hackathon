import express from "express";
import cors from "cors";
import { createServer } from "http";
import { config } from "./config";
import { logger } from "./logger";
import { initSockets } from "./sockets";
import { errorHandler } from "./middleware/errorHandler";

import { authRouter } from "./routes/auth";
import { universitiesRouter } from "./routes/universities";
import { categoriesRouter } from "./routes/categories";
import { questionsRouter } from "./routes/questions";
import { expertsRouter } from "./routes/experts";
import { adminRouter } from "./routes/admin";
import { studentRouter } from "./routes/student";
import { maxWebhookRouter } from "./max/webhook";

const app = express();
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, mockMax: config.mockMax }));

app.use("/api", authRouter);
app.use("/api", universitiesRouter);
app.use("/api", categoriesRouter);
app.use("/api", questionsRouter);
app.use("/api", expertsRouter);
app.use("/api", adminRouter);
app.use("/api", studentRouter);

// MAX webhook is mounted at the root (not under /api) since the platform's
// webhook URL registration is independent of our own REST namespace.
app.use(maxWebhookRouter);

app.use(errorHandler);

const httpServer = createServer(app);
initSockets(httpServer);

httpServer.listen(config.port, () => {
  logger.info("server.started", { port: config.port, mockMax: config.mockMax, nodeEnv: config.nodeEnv });
});
