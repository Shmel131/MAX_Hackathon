import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { Role } from "../db/models";
import { users } from "../db/store";
import { asyncHandler } from "../utils/asyncHandler";
import { requireStaff, requireUniversityAdmin, requirePlatformAdmin, AuthedRequest } from "../middleware/auth";

export const adminRouter = Router();

function generatePassword() {
  return crypto.randomBytes(6).toString("base64url");
}

const inviteSchema = z.object({
  displayName: z.string().min(2),
  email: z.string().email(),
  isStaff: z.boolean().default(false),
  startingRole: z.enum(["HELPER", "KNOWER", "PRO"]).default("HELPER"),
});

/**
 * University admin invites a new answerer (student volunteer, curator, staff
 * member, psychologist, etc.). This is the "not everyone can answer" gate —
 * only people invited here get isAnswerer=true. A demo password is generated
 * and returned once; in production this would instead send an email/MAX
 * invite link.
 */
adminRouter.post(
  "/admin/universities/:universityId/experts",
  requireStaff,
  requireUniversityAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    const universityId = req.params.universityId;
    if (!req.auth?.isPlatformAdmin && req.auth?.universityId !== universityId) {
      return res.status(403).json({ error: "cannot manage another university" });
    }
    const data = inviteSchema.parse(req.body);
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    const user = users.create({
      displayName: data.displayName,
      email: data.email,
      passwordHash,
      universityId,
      isAnswerer: 1,
      isStaff: data.isStaff ? 1 : 0,
      role: data.startingRole as Role,
    });

    res.status(201).json({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      temporaryPassword: password,
    });
  })
);

adminRouter.get(
  "/admin/universities/:universityId/experts",
  requireStaff,
  requireUniversityAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    const universityId = req.params.universityId;
    if (!req.auth?.isPlatformAdmin && req.auth?.universityId !== universityId) {
      return res.status(403).json({ error: "cannot manage another university" });
    }
    res.json(users.findAnswerersByUniversity(universityId));
  })
);

const setRoleSchema = z.object({ role: z.enum(["HELPER", "KNOWER", "PRO"]) });

/** Manual role override for verified staff (bypasses the points ladder). */
adminRouter.patch(
  "/admin/experts/:id/role",
  requireStaff,
  requireUniversityAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    const target = users.findById(req.params.id);
    if (!target) return res.status(404).json({ error: "not found" });
    if (!req.auth?.isPlatformAdmin && req.auth?.universityId !== target.universityId) {
      return res.status(403).json({ error: "cannot manage another university" });
    }
    const { role } = setRoleSchema.parse(req.body);
    const updated = users.update(target.id, { role: role as Role });
    res.json(updated);
  })
);

/** Platform admin creates a university admin account for a newly onboarded university. */
const createUniAdminSchema = z.object({
  displayName: z.string().min(2),
  email: z.string().email(),
});

adminRouter.post(
  "/admin/universities/:universityId/admins",
  requireStaff,
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const universityId = req.params.universityId;
    const data = createUniAdminSchema.parse(req.body);
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    const user = users.create({
      displayName: data.displayName,
      email: data.email,
      passwordHash,
      universityId,
      isUniversityAdmin: 1,
    });

    res.status(201).json({ id: user.id, email: user.email, temporaryPassword: password });
  })
);
