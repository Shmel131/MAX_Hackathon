import { Router } from "express";
import { questions as questionsStore, categories as categoriesStore, users, answers as answersStore } from "../db/store";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { roleAtLeast } from "../types";
import { getIO } from "../sockets";
import { logger } from "../logger";

export const questionsRouter = Router();

/** Live queue of unassigned/eligible questions for the logged-in expert. */
questionsRouter.get(
  "/questions/queue",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = users.findById(req.auth!.userId);
    if (!user || !user.isAnswerer || !user.universityId) {
      return res.status(403).json({ error: "not an eligible answerer" });
    }

    const open = questionsStore.findOpenByUniversity(user.universityId);
    const eligible = open
      .map((q) => ({ ...q, category: categoriesStore.findById(q.categoryId)! }))
      .filter((q) => {
        if (q.category.isSensitive && user.isStaff !== 1) return false;
        return roleAtLeast(user.role, q.category.minRole);
      });

    res.json(eligible);
  })
);

questionsRouter.get(
  "/questions/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const question = questionsStore.findById(req.params.id);
    if (!question) return res.status(404).json({ error: "not found" });
    const category = categoriesStore.findById(question.categoryId);
    res.json({ ...question, category, answers: answersStore.findByQuestion(question.id) });
  })
);

/** Expert claims a question so it stops showing up in every other expert's queue. */
questionsRouter.post(
  "/questions/:id/claim",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = users.findById(req.auth!.userId);
    if (!user || !user.isAnswerer) return res.status(403).json({ error: "not an eligible answerer" });

    const question = questionsStore.findById(req.params.id);
    if (!question) return res.status(404).json({ error: "not found" });
    const category = categoriesStore.findById(question.categoryId)!;
    if (question.universityId !== user.universityId) return res.status(403).json({ error: "different university" });
    if (category.isSensitive && user.isStaff !== 1) return res.status(403).json({ error: "staff only" });
    if (!roleAtLeast(user.role, category.minRole)) return res.status(403).json({ error: "role too low" });
    if (question.assignedToId) return res.status(409).json({ error: "already claimed" });

    const updated = questionsStore.update(question.id, {
      status: "ROUTED",
      assignedToId: user.id,
      routedAt: new Date().toISOString(),
    });

    getIO().to(`university:${question.universityId}`).emit("question:claimed", {
      questionId: question.id,
      assignedTo: { id: user.id, displayName: user.displayName },
    });
    logger.info("question.claimed", { questionId: question.id, userId: user.id });

    res.json(updated);
  })
);
