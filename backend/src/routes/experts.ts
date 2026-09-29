import { Router } from "express";
import { users } from "../db/store";
import { asyncHandler } from "../utils/asyncHandler";
import { ROLE_LABELS_RU } from "../types";

export const expertsRouter = Router();

expertsRouter.get(
  "/universities/:universityId/leaderboard",
  asyncHandler(async (req, res) => {
    const experts = users.findAnswerersByUniversity(req.params.universityId).slice(0, 50);

    res.json(
      experts.map((e) => ({
        id: e.id,
        displayName: e.displayName,
        role: e.role,
        roleLabel: ROLE_LABELS_RU[e.role],
        aura: e.aura,
        isStaff: !!e.isStaff,
        answersCount: users.countAnswers(e.id),
      }))
    );
  })
);
