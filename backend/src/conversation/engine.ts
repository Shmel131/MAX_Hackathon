import { Channel } from "../db/models";
import { universities, categories as categoriesStore, chatSessions, questions as questionsStore } from "../db/store";
import { findEligibleExperts } from "../routing/matcher";
import { getIO } from "../sockets";
import { logger } from "../logger";
import { moderateQuestionText } from "../moderation";

/**
 * Shared conversation state machine for the "выбор вуза → категория → вопрос"
 * wizard. Both the real MAX webhook handler (src/max/webhook.ts) and the
 * student's "Задать вопрос" flow in the web app
 * (src/routes/student.ts → frontend/src/pages/AskQuestion.tsx) drive the same
 * engine — only how the resulting message is *rendered* differs.
 *
 * A studentId is required to create a Question: for MAX it is resolved from
 * the platform's own user id before calling into this module (see
 * max/webhook.ts); for the web app it comes from the student's own JWT.
 */

export type Button = { id: string; label: string };
export interface EngineReply {
  text: string;
  buttons?: Button[];
  questionId?: string;
  done?: boolean;
}

const CMD_START = /^\/start\b/i;

export function getOrCreateSession(channel: Channel, externalChatId: string, studentId: string) {
  let session = chatSessions.findByExternalId(externalChatId);
  if (!session) {
    session = chatSessions.create({ channel, externalChatId, studentId });
  } else if (session.studentId !== studentId) {
    session = chatSessions.update(session.id, { studentId });
  }
  return session;
}

function universityButtons(): Button[] {
  return universities.findActive().map((u) => ({ id: u.id, label: u.name }));
}

function categoryButtons(universityId: string): Button[] {
  return categoriesStore
    .findByUniversity(universityId)
    .map((c) => ({ id: c.id, label: c.isSensitive ? `${c.title} (конфиденциально)` : c.title }));
}

export function startOrResetWizard(externalChatId: string, channel: Channel, studentId: string): EngineReply {
  const session = getOrCreateSession(channel, externalChatId, studentId);
  chatSessions.update(session.id, { step: "SELECT_UNIVERSITY", universityId: null, categoryId: null });
  const buttons = universityButtons();
  if (buttons.length === 0) {
    return { text: "Пока ни один вуз не подключён к сервису. Загляните позже 🙌" };
  }
  return {
    text: "Привет! Я помогу быстро получить ответ от представителя вашего вуза в реальном времени.\n\nВыберите вуз:",
    buttons,
  };
}

/** Handles a button click (university/category selection). buttonId is the entity id. */
export function handleButtonClick(channel: Channel, externalChatId: string, studentId: string, buttonId: string): EngineReply {
  const session = getOrCreateSession(channel, externalChatId, studentId);

  if (session.step === "SELECT_UNIVERSITY") {
    const university = universities.findById(buttonId);
    if (!university) {
      return { text: "Такой вуз не найден. Попробуйте ещё раз.", buttons: universityButtons() };
    }
    chatSessions.update(session.id, { universityId: university.id, categoryId: null, step: "SELECT_CATEGORY" });
    const buttons = categoryButtons(university.id);
    if (buttons.length === 0) {
      return { text: `В «${university.name}» пока не настроены категории вопросов. Загляните позже.` };
    }
    return { text: `Вуз: ${university.name}.\n\nО чём хотите спросить?`, buttons };
  }

  if (session.step === "SELECT_CATEGORY") {
    if (!session.universityId) return startOrResetWizard(externalChatId, channel, studentId);
    const category = categoriesStore.findById(buttonId);
    if (!category || category.universityId !== session.universityId) {
      return { text: "Такая категория не найдена. Попробуйте ещё раз.", buttons: categoryButtons(session.universityId) };
    }
    chatSessions.update(session.id, { categoryId: category.id, step: "AWAIT_QUESTION" });
    const hint = category.isSensitive
      ? "\n\nЭта тема конфиденциальна — вопрос увидят только сотрудники вуза."
      : "";
    return { text: `Категория: ${category.title}.${hint}\n\nНапишите ваш вопрос одним сообщением.` };
  }

  return startOrResetWizard(externalChatId, channel, studentId);
}

/** Handles a free-text message: either a command, or (if AWAIT_QUESTION) the question itself. */
export function handleTextMessage(channel: Channel, externalChatId: string, studentId: string, text: string): EngineReply {
  if (CMD_START.test(text)) {
    return startOrResetWizard(externalChatId, channel, studentId);
  }

  const session = getOrCreateSession(channel, externalChatId, studentId);

  if (session.step !== "AWAIT_QUESTION" || !session.universityId || !session.categoryId) {
    // Nudge the user back into the flow instead of dropping the message.
    const reset = startOrResetWizard(externalChatId, channel, studentId);
    return { ...reset, text: `Похоже, диалог сбился. Начнём заново.\n\n${reset.text}` };
  }

  const category = categoriesStore.findById(session.categoryId);
  if (!category) {
    // Defensive default: the category the student picked no longer exists
    // (deleted by an admin mid-conversation) — say so plainly instead of
    // silently resetting the whole wizard with no explanation.
    const reset = startOrResetWizard(externalChatId, channel, studentId);
    return { ...reset, text: `Кажется, выбранная категория больше недоступна. Начнём заново.\n\n${reset.text}` };
  }

  const moderation = moderateQuestionText(text);
  if (!moderation.ok) {
    // Stay on the same step so the student can just retype the question.
    return { text: moderation.reason! };
  }

  const question = questionsStore.create({
    universityId: session.universityId,
    categoryId: session.categoryId,
    studentId,
    channel,
    externalChatId,
    text,
    isSensitive: category.isSensitive,
    status: category.isSensitive ? "ESCALATED" : "PENDING",
  });

  const eligible = findEligibleExperts(session.universityId, session.categoryId);
  logger.info("question.created", { questionId: question.id, categoryId: category.code, eligibleCount: eligible.length });

  getIO().to(`university:${session.universityId}`).emit("question:new", {
    questionId: question.id,
    categoryId: category.id,
    categoryTitle: category.title,
    text: question.text,
    isSensitive: !!question.isSensitive,
    createdAt: question.createdAt,
  });

  // Wizard is done for this turn — the question now lives in "Мои вопросы" /
  // the expert's inbox as an ordinary thread; further replies use the thread
  // endpoints, not this wizard.
  chatSessions.update(session.id, { step: "DONE" });

  return {
    text: "Спасибо! Вопрос отправлен доступным специалистам вуза. Ответ появится в разделе «Мои вопросы» — там же можно писать специалисту дальше и закрыть вопрос, когда он не нужен.",
    questionId: question.id,
    done: true,
  };
}
