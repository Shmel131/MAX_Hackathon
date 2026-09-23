import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  logger.error("http.unhandled_error", { error: err instanceof Error ? err.message : String(err), path: req.path });
  res.status(500).json({ error: "internal server error" });
}
