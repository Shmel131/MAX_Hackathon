import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { JwtPayload } from "../types";

export interface AuthedRequest extends Request {
  auth?: JwtPayload;
}

function verify(req: AuthedRequest): JwtPayload | null {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice(7), config.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

/** Accepts either a staff or a student token and attaches it to req.auth. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const payload = verify(req);
  if (!payload) return res.status(401).json({ error: "missing or invalid token" });
  req.auth = payload;
  next();
}

export function requireStaff(req: AuthedRequest, res: Response, next: NextFunction) {
  const payload = verify(req);
  if (!payload || payload.kind !== "staff") return res.status(401).json({ error: "staff token required" });
  req.auth = payload;
  next();
}

export function requireStudent(req: AuthedRequest, res: Response, next: NextFunction) {
  const payload = verify(req);
  if (!payload || payload.kind !== "student") return res.status(401).json({ error: "student token required" });
  req.auth = payload;
  next();
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
