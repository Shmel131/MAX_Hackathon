import { Router } from "express";
import { z } from "zod";
import { Role } from "../db/models";
import { categories } from "../db/store";
import { asyncHandler } from "../utils/asyncHandler";
import { requireStaff, requireUniversityAdmin, AuthedRequest } from "../middleware/auth";

export const categoriesRouter = Router();

categoriesRouter.get(
  "/universities/:universityId/categories",
  asyncHandler(async (req, res) => {
    res.json(categories.findByUniversity(req.params.universityId));
  })
);

const roleEnum = z.enum(["HELPER", "KNOWER", "PRO"]);
const createSchema = z.object({
  code: z.string().min(2),
  title: z.string().min(2),
  description: z.string().optional(),
  minRole: roleEnum.default("HELPER"),
  isSensitive: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

categoriesRouter.post(
  "/universities/:universityId/categories",
  requireStaff,
  requireUniversityAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    const universityId = req.params.universityId;
    if (!req.auth?.isPlatformAdmin && req.auth?.universityId !== universityId) {
      return res.status(403).json({ error: "cannot manage another university" });
    }
    const data = createSchema.parse(req.body);
    const category = categories.create(universityId, { ...data, minRole: data.minRole as Role });
    res.status(201).json(category);
  })
);

categoriesRouter.patch(
  "/categories/:id",
  requireStaff,
  requireUniversityAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    const category = categories.findById(req.params.id);
    if (!category) return res.status(404).json({ error: "not found" });
    if (!req.auth?.isPlatformAdmin && req.auth?.universityId !== category.universityId) {
      return res.status(403).json({ error: "cannot manage another university" });
    }
    const data = createSchema.partial().parse(req.body);
    const updated = categories.update(req.params.id, {
      ...data,
      minRole: data.minRole as Role | undefined,
      isSensitive: data.isSensitive === undefined ? undefined : data.isSensitive ? 1 : 0,
    } as any);
    res.json(updated);
  })
);

categoriesRouter.delete(
  "/categories/:id",
  requireStaff,
  requireUniversityAdmin,
  asyncHandler(async (req: AuthedRequest, res) => {
    const category = categories.findById(req.params.id);
    if (!category) return res.status(404).json({ error: "not found" });
    if (!req.auth?.isPlatformAdmin && req.auth?.universityId !== category.universityId) {
      return res.status(403).json({ error: "cannot manage another university" });
    }
    categories.remove(req.params.id);
    res.status(204).end();
  })
);
