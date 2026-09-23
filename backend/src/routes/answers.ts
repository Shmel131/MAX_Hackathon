import { Router } from "express";
import { z } from "zod";
import { questions as questionsStore, categories as categoriesStore, users, answers as answersStore } from "../db/store";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { awardPoints, POINTS } from "../reputation";
import { config } from "../config";
import { sendMaxMessage } from "../max/client";
import { emitAnswerToChat } from "../sockets";
import { roleAtLeast } from "../types";
import { logger } from "../logger";

export const answersRouter = Router();

const answerSchema = z.object({ text: z.string().min(1) });

/** Expert submits an answer to a question they've claimed (or an open one, for fast-moving queues). */
answersRouter.post(
  "/questions/:id/answers",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { text } = answerSchema.parse(req.body);
    const user = users.findById(req.auth!.userId);
    if (!user || !user.isAnswerer) return res.status(403).json({ error: "not an eligible answerer" });

    const question = questionsStore.findById(req.params.id);
    if (!question) return res.status(404).json({ error: "not found" });
    const category = categoriesStore.findById(question.categoryId)!;
    if (question.universityId !== user.universityId) return res.status(403).json({ error: "different university" });
    if (category.isSensitive && user.isStaff !== 1) return res.status(403).json({ error: "staff only" });
    if (!roleAtLeast(user.role, category.minRole)) return res.status(403).json({ error: "role too low" });
    if (question.status === "CLOSED") return res.status(409).json({ error: "question already closed" });

    const respondedInSeconds = Math.round((Date.now() - new Date(question.createdAt).getTime()) / 1000);

    const answer = answersStore.create({ questionId: question.id, responderId: user.id, text, respondedInSeconds });

    questionsStore.update(question.id, {
      status: "ANSWERED",
      assignedToId: user.id,
      answeredAt: new Date().toISOString(),
    });

    if (respondedInSeconds <= config.fastResponseThresholdSeconds) {
      await awardPoints(user.id, POINTS.FAST_RESPONSE_BONUS, "fast_response");
    }

    // Deliver the answer back to the asker over whichever channel they came from.
    if (question.channel === "MAX") {
      await sendMaxMessage({
        chatId: question.externalChatId,
        text: `Ответ от эксперта вуза (${user.displayName}):\n\n${text}`,
      });
    } else {
      emitAnswerToChat(question.externalChatId, {
        questionId: question.id,
        answerId: answer.id,
        text,
        responder: { displayName: user.displayName, role: user.role },
      });
    }

    logger.info("answer.created", { questionId: question.id, answerId: answer.id, responderId: user.id });
    res.status(201).json(answer);
  })
);

const rateSchema = z.object({ rating: z.enum(["HELPFUL", "NOT_HELPFUL", "RESOLVED"]) });

/** Asker rates an answer — this is what feeds the reputation system. */
answersRouter.post(
  "/answers/:id/rate",
  asyncHandler(async (req, res) => {
    const { rating } = rateSchema.parse(req.body);
    const answer = answersStore.findById(req.params.id);
    if (!answer) return res.status(404).json({ error: "not found" });
    if (answer.rating) return res.status(409).json({ error: "already rated" });

    answersStore.setRating(answer.id, rating);

    const points =
      rating === "RESOLVED" ? POINTS.ANSWER_RESOLVED : rating === "HELPFUL" ? POINTS.ANSWER_HELPFUL : POINTS.ANSWER_NOT_HELPFUL;
    await awardPoints(answer.responderId, points, `answer_rated_${rating.toLowerCase()}`);

    if (rating === "RESOLVED") {
      questionsStore.update(answer.questionId, { status: "CLOSED" });
    }

    res.json({ ok: true });
  })
);
