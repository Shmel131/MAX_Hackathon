import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { JwtPayload } from "../types";

export interface AuthedRequest extends Request {
  auth?: JwtPayload;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing bearer token" });
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as JwtPayload;
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

export function requirePlatformAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.auth?.isPlatformAdmin) {
    return res.status(403).json({ error: "platform admin only" });
  }
  next();
}

export function requireUniversityAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.auth?.isPlatformAdmin && !req.auth?.isUniversityAdmin) {
    return res.status(403).json({ error: "university admin only" });
  }
  next();
}
