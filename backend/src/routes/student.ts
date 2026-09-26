import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import { asyncHandler } from "../utils/asyncHandler";
import { requireStudent, AuthedRequest } from "../middleware/auth";
import { JwtPayload } from "../types";
import { students, questions as questionsStore, categories as categoriesStore, universities, messages as messagesStore, users } from "../db/store";
import { startOrResetWizard, handleButtonClick, handleTextMessage } from "../conversation/engine";
import { awardAura, AURA } from "../reputation";
import { emitToUniversity } from "../sockets";
import { logger } from "../logger";
import { moderateQuestionText } from "../moderation";

export const studentRouter = Router();

/**
 * MVP login: a display name only — no password. A JWT is issued and stored
 * client-side (see README, п.7 — a real product would authenticate a MAX
 * user automatically via their platform id, exactly like max/webhook.ts
 * already does; this endpoint exists only because the *web* app has no such
 * identity to piggy-back on).
 *
 * Logging in with the same name again reuses the existing student record
 * (findOrCreateByDisplayName) instead of creating a brand-new one every
 * time — otherwise every re-login would orphan the student's previous
 * questions, which used to make "Мои вопросы" appear empty after logout.
 */
studentRouter.post(
  "/student/login",
  asyncHandler(async (req, res) => {
    const { displayName } = z.object({ displayName: z.string().trim().min(1).max(80) }).parse(req.body);
    const student = students.findOrCreateByDisplayName(displayName);
    const payload: JwtPayload = { kind: "student", studentId: student.id, displayName: student.displayName };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: "180d" });
    res.status(201).json({ token, student: { id: student.id, displayName: student.displayName } });
  })
);

function questionSummary(q: ReturnType<typeof questionsStore.findById>) {
  if (!q) return null;
  const category = categoriesStore.findById(q.categoryId);
  const university = universities.findById(q.universityId);
  const last = messagesStore.lastByQuestion(q.id);
  const expert = q.assignedToId ? users.findById(q.assignedToId) : undefined;
  return {
    id: q.id,
    text: q.text,
    status: q.status,
    isSensitive: !!q.isSensitive,
    askerRating: q.askerRating,
    createdAt: q.createdAt,
    category: category ? { id: category.id, title: category.title } : null,
    university: university ? { id: university.id, name: university.name } : null,
    expert: expert ? { displayName: expert.displayName, role: expert.role } : null,
    lastMessagePreview: last ? last.text.slice(0, 140) : null,
    lastMessageAt: last?.createdAt ?? q.createdAt,
  };
}

/** "Мои вопросы" — every question this student has ever asked, newest first. */
studentRouter.get(
  "/student/questions",
  requireStudent,
  asyncHandler(async (req: AuthedRequest, res) => {
    const list = questionsStore.findByStudent(req.auth!.studentId!).map(questionSummary);
    res.json(list);
  })
);

studentRouter.get(
  "/student/questions/:id",
  requireStudent,
  asyncHandler(async (req: AuthedRequest, res) => {
    const question = questionsStore.findById(req.params.id);
    if (!question || question.studentId !== req.auth!.studentId) return res.status(404).json({ error: "not found" });
    res.json({ ...questionSummary(question), messages: messagesStore.findByQuestion(question.id) });
  })
);

const messageSchema = z.object({ text: z.string().min(1) });

/** Student sends a follow-up message (continue the dialog with the responder). */
studentRouter.post(
  "/student/questions/:id/messages",
  requireStudent,
  asyncHandler(async (req: AuthedRequest, res) => {
    const question = questionsStore.findById(req.params.id);
    if (!question || question.studentId !== req.auth!.studentId) return res.status(404).json({ error: "not found" });
    if (question.status === "CLOSED") return res.status(409).json({ error: "question is closed" });

    const { text } = messageSchema.parse(req.body);
    const moderation = moderateQuestionText(text);
    if (!moderation.ok) return res.status(422).json({ error: moderation.reason });

    const message = messagesStore.create({ questionId: question.id, senderType: "STUDENT", senderId: question.studentId, text });

    emitToUniversity(question.universityId, "question:message", { questionId: question.id, message });
    logger.info("student.message", { questionId: question.id });
    res.status(201).json(message);
  })
);

/** Student closes a question they're no longer interested in (hides it from the expert queue too). */
studentRouter.post(
  "/student/questions/:id/close",
  requireStudent,
  asyncHandler(async (req: AuthedRequest, res) => {
    const question = questionsStore.findById(req.params.id);
    if (!question || question.studentId !== req.auth!.studentId) return res.status(404).json({ error: "not found" });
    const updated = questionsStore.update(question.id, { status: "CLOSED", closedAt: new Date().toISOString() });
    emitToUniversity(question.universityId, "question:closed", { questionId: question.id });
    res.json(updated);
  })
);

const rateSchema = z.object({ rating: z.enum(["HELPFUL", "NOT_HELPFUL", "RESOLVED"]) });

/** Student rates the answer(s) they've received — this drives aura. */
studentRouter.post(
  "/student/questions/:id/rate",
  requireStudent,
  asyncHandler(async (req: AuthedRequest, res) => {
    const question = questionsStore.findById(req.params.id);
    if (!question || question.studentId !== req.auth!.studentId) return res.status(404).json({ error: "not found" });
    if (!question.assignedToId) return res.status(409).json({ error: "no responder yet" });
    if (question.askerRating) return res.status(409).json({ error: "already rated" });

    const { rating } = rateSchema.parse(req.body);
    questionsStore.update(question.id, { askerRating: rating });

    // All aura for this question is granted right here, once, at rating
    // time — never when the expert merely answers. A quick first response
    // still earns a small bonus, but only once the student confirms it was
    // actually useful (HELPFUL/RESOLVED), computed from answeredAt.
    const basePoints = rating === "RESOLVED" ? AURA.ANSWER_RESOLVED : rating === "HELPFUL" ? AURA.ANSWER_HELPFUL : AURA.ANSWER_NOT_HELPFUL;
    let points = basePoints;
    if ((rating === "RESOLVED" || rating === "HELPFUL") && question.answeredAt) {
      const respondedInSeconds = Math.round((new Date(question.answeredAt).getTime() - new Date(question.createdAt).getTime()) / 1000);
      if (respondedInSeconds <= config.fastResponseThresholdSeconds) {
        points += AURA.FAST_RESPONSE_BONUS;
      }
    }
    await awardAura(question.assignedToId, points, `answer_rated_${rating.toLowerCase()}`);

    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// "Задать вопрос" wizard (университет → категория → текст вопроса)
// ---------------------------------------------------------------------------
const wizardIdSchema = z.object({ wizardId: z.string().min(1) });

studentRouter.post(
  "/student/ask/start",
  requireStudent,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { wizardId } = wizardIdSchema.parse(req.body);
    const reply = startOrResetWizard(`web:${wizardId}`, "SIMULATOR", req.auth!.studentId!);
    res.json(reply);
  })
);

studentRouter.post(
  "/student/ask/click",
  requireStudent,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { wizardId, buttonId } = wizardIdSchema.extend({ buttonId: z.string().min(1) }).parse(req.body);
    const reply = handleButtonClick("SIMULATOR", `web:${wizardId}`, req.auth!.studentId!, buttonId);
    res.json(reply);
  })
);

studentRouter.post(
  "/student/ask/message",
  requireStudent,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { wizardId, text } = wizardIdSchema.extend({ text: z.string().min(1) }).parse(req.body);
    const reply = handleTextMessage("SIMULATOR", `web:${wizardId}`, req.auth!.studentId!, text);
    res.json(reply);
  })
);
