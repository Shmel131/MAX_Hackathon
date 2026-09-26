import { Router } from "express";
import { z } from "zod";
import { universities } from "../db/store";
import { asyncHandler } from "../utils/asyncHandler";
import { requireStaff, requirePlatformAdmin, AuthedRequest } from "../middleware/auth";

export const universitiesRouter = Router();

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
});

// Platform admin onboards a new university organization onto the service —
// this is the "how do universities connect" mechanism described in the idea.
universitiesRouter.post(
  "/universities",
  requireStaff,
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const university = universities.create(data);
    res.status(201).json(university);
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
