import { Router } from "express";
import { z } from "zod";
import {
  questions as questionsStore,
  categories as categoriesStore,
  users,
  messages as messagesStore,
  students,
} from "../db/store";
import { asyncHandler } from "../utils/asyncHandler";
import { requireStaff, AuthedRequest } from "../middleware/auth";
import { roleAtLeast } from "../types";
import { getIO, emitToStudent } from "../sockets";
import { sendMaxMessage } from "../max/client";
import { logger } from "../logger";

export const questionsRouter = Router();

function enrich(q: ReturnType<typeof questionsStore.findById>) {
  if (!q) return null;
  const category = categoriesStore.findById(q.categoryId);
  const student = students.findById(q.studentId);
  const assignedTo = q.assignedToId ? users.findById(q.assignedToId) : undefined;
  return {
    ...q,
    category,
    studentName: student?.displayName ?? "Гость",
    assignedTo: assignedTo ? { id: assignedTo.id, displayName: assignedTo.displayName } : null,
  };
}

/**
 * The expert's worklist: unclaimed questions they're eligible to answer,
 * PLUS every question already assigned to them (so claiming a question
 * moves it into an ongoing thread instead of making it disappear — see
 * README changelog, issue "взять в работу удаляет вопрос").
 */
questionsRouter.get(
  "/questions/queue",
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = users.findById(req.auth!.userId!);
    if (!user || !user.isAnswerer || !user.universityId) {
      return res.status(403).json({ error: "not an eligible answerer" });
    }

    const all = questionsStore.findOpenByUniversity(user.universityId).map((q) => ({ ...q, category: categoriesStore.findById(q.categoryId)! }));

    const mine = all.filter((q) => q.assignedToId === user.id);
    const unclaimed = all.filter((q) => {
      if (q.assignedToId) return false;
      if (q.category.isSensitive && user.isStaff !== 1) return false;
      return roleAtLeast(user.role, q.category.minRole);
    });

    res.json({
      unclaimed: unclaimed.map(enrich),
      mine: mine.map(enrich),
    });
  })
);

questionsRouter.get(
  "/questions/:id",
  requireStaff,
  asyncHandler(async (req, res) => {
    const question = questionsStore.findById(req.params.id);
    if (!question) return res.status(404).json({ error: "not found" });
    res.json({ ...enrich(question), messages: messagesStore.findByQuestion(question.id) });
  })
);

/** Expert claims a question so it stops showing up in every other expert's unclaimed list. */
questionsRouter.post(
  "/questions/:id/claim",
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = users.findById(req.auth!.userId!);
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

    res.json(enrich(updated));
  })
);

const messageSchema = z.object({ text: z.string().min(1) });

/** Expert sends a message in the thread — the first one answers the question, further ones continue the dialog. */
questionsRouter.post(
  "/questions/:id/messages",
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { text } = messageSchema.parse(req.body);
    const user = users.findById(req.auth!.userId!);
    if (!user || !user.isAnswerer) return res.status(403).json({ error: "not an eligible answerer" });

    const question = questionsStore.findById(req.params.id);
    if (!question) return res.status(404).json({ error: "not found" });
    const category = categoriesStore.findById(question.categoryId)!;
    if (question.universityId !== user.universityId) return res.status(403).json({ error: "different university" });
    if (category.isSensitive && user.isStaff !== 1) return res.status(403).json({ error: "staff only" });
    if (!roleAtLeast(user.role, category.minRole)) return res.status(403).json({ error: "role too low" });
    if (question.status === "CLOSED") return res.status(409).json({ error: "question already closed" });
    if (question.assignedToId && question.assignedToId !== user.id) {
      return res.status(403).json({ error: "already claimed by another expert" });
    }

    const isFirstAnswer = !messagesStore.hasExpertMessage(question.id);
    const message = messagesStore.create({ questionId: question.id, senderType: "EXPERT", senderId: user.id, text });

    const patch: Partial<typeof question> = { assignedToId: user.id };
    if (isFirstAnswer) {
      patch.status = "ANSWERED";
      patch.answeredAt = new Date().toISOString();
    }
    if (!question.routedAt) patch.routedAt = new Date().toISOString();
    questionsStore.update(question.id, patch);

    // NOTE: no aura is awarded here. Aura is only ever granted once the
    // student rates the answer (see /student/questions/:id/rate) — an expert
    // answering does not by itself earn anything, on purpose, so aura always
    // reflects real, rated help. The fast-response bonus is computed and
    // added at rating time instead, based on question.answeredAt.

    // Deliver to the student over whichever channel they came from.
    if (question.channel === "MAX") {
      await sendMaxMessage({ chatId: question.externalChatId, text: `${user.displayName}:\n\n${text}` });
    } else {
      emitToStudent(question.studentId, "question:message", {
        questionId: question.id,
        message,
        responder: { displayName: user.displayName, role: user.role },
      });
    }

    logger.info("message.created", { questionId: question.id, responderId: user.id, isFirstAnswer });
    res.status(201).json(message);
  })
);
