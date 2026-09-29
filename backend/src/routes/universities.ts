import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { universities, users } from "../db/store";
import { asyncHandler } from "../utils/asyncHandler";
import { requireStaff, requirePlatformAdmin, AuthedRequest } from "../middleware/auth";
import { Role } from "../db/models";

export const universitiesRouter = Router();

function generatePassword() {
  return crypto.randomBytes(6).toString("base64url");
}

universitiesRouter.get(
  "/universities",
  asyncHandler(async (req, res) => {
    const list = universities.findActive().map((u) => ({ ...u, _count: universities.counts(u.id) }));
    res.json(list);
  })
);

universitiesRouter.get(
  "/universities/:id",
  asyncHandler(async (req, res) => {
    const university = universities.findById(req.params.id);
    if (!university) return res.status(404).json({ error: "not found" });
    res.json(university);
  })
);

const createSchema = z.object({
  slug: z.string().min(2),
  name: z.string().min(2),
  city: z.string().optional(),
  description: z.string().optional(),
  adminDisplayName: z.string().min(2),
  adminEmail: z.string().email(),
});

universitiesRouter.post(
  "/universities",
  requireStaff,
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const { adminDisplayName, adminEmail, ...universityData } = createSchema.parse(req.body);
    const university = universities.create(universityData);

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = users.create({
      displayName: adminDisplayName,
      email: adminEmail,
      passwordHash,
      universityId: university.id,
      isUniversityAdmin: 1,
      isAnswerer: 1,
      isStaff: 1,
      role: "PRO" as Role,
    });

    res.status(201).json({
      university,
      admin: {
        id: admin.id,
        displayName: admin.displayName,
        email: admin.email,
        temporaryPassword: password,
        loginUrl: "/login",
      },
    });
  })
);

universitiesRouter.patch(
  "/universities/:id",
  requireStaff,
  requirePlatformAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = createSchema.partial().parse(req.body);
    const university = universities.update(req.params.id, data);
    if (!university) return res.status(404).json({ error: "not found" });
    res.json(university);
  })
);
