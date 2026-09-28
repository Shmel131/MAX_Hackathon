import { Router } from "express";
import { users } from "../db/store";
import { asyncHandler } from "../utils/asyncHandler";
import { ROLE_LABELS_RU } from "../types";

export const expertsRouter = Router();

/** Public leaderboard per university — top answerers by aura. Visible to
 * students too (Рейтинг is not gated behind staff login). */
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
        isOnline: !!e.isOnline,
        isStaff: !!e.isStaff,
        answersCount: users.countAnswers(e.id),
      }))
    );
  })
);
