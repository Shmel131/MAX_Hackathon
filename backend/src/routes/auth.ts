import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { users } from "../db/store";
import { config } from "../config";
import { asyncHandler } from "../utils/asyncHandler";
import { JwtPayload } from "../types";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

function toPublicUser(user: ReturnType<typeof users.findById>) {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    reputationPoints: user.reputationPoints,
    isAnswerer: !!user.isAnswerer,
    isUniversityAdmin: !!user.isUniversityAdmin,
    isPlatformAdmin: !!user.isPlatformAdmin,
    isStaff: !!user.isStaff,
    universityId: user.universityId,
  };
}

authRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = users.findByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    const payload: JwtPayload = {
      userId: user.id,
      isPlatformAdmin: !!user.isPlatformAdmin,
      isUniversityAdmin: !!user.isUniversityAdmin,
      universityId: user.universityId,
    };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: "12h" });

    res.json({ token, user: toPublicUser(user) });
  })
);

authRouter.get(
  "/auth/me",
  asyncHandler(async (req, res) => {
    const header = req.header("Authorization");
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "missing token" });
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as JwtPayload;
      const user = users.findById(payload.userId);
      if (!user) return res.status(404).json({ error: "not found" });
      res.json(toPublicUser(user));
    } catch {
      res.status(401).json({ error: "invalid token" });
    }
  })
);
