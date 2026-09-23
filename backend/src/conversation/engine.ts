import { Channel } from "../db/models";
import { universities, categories as categoriesStore, chatSessions, questions as questionsStore } from "../db/store";
import { findEligibleExperts } from "../routing/matcher";
import { getIO } from "../sockets";
import { logger } from "../logger";

/**
 * Shared conversation state machine. Both the real MAX webhook handler
 * (src/max/webhook.ts) and the browser Chat Simulator (src/routes/simulator.ts)
 * drive the exact same engine, so the primary user scenario behaves identically
 * regardless of transport — only how the resulting message is *rendered*
 * (MAX inline keyboard vs. JSON button list) differs at the edges.
 */

export type Button = { id: string; label: string };
export interface EngineReply {
  text: string;
  buttons?: Button[];
  questionId?: string;
}

const CMD_START = /^\/start\b/i;
const CMD_CHANGE_UNIVERSITY = /^\/university\b/i;

export async function getOrCreateSession(channel: Channel, externalChatId: string, askerName?: string) {
  let session = chatSessions.findByExternalId(externalChatId);
  if (!session) {
    session = chatSessions.create({ channel, externalChatId, askerName });
  } else if (askerName && !session.askerName) {
    session = chatSessions.update(session.id, { askerName });
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

export async function startOrResetGreeting(externalChatId: string, channel: Channel, askerName?: string): Promise<EngineReply> {
  const session = await getOrCreateSession(channel, externalChatId, askerName);
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
export async function handleButtonClick(
  channel: Channel,
  externalChatId: string,
  buttonId: string
): Promise<EngineReply> {
  const session = await getOrCreateSession(channel, externalChatId);

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
    if (!session.universityId) return startOrResetGreeting(externalChatId, channel);
    const category = categoriesStore.findById(buttonId);
    if (!category || category.universityId !== session.universityId) {
      return { text: "Такая категория не найдена. Попробуйте ещё раз.", buttons: categoryButtons(session.universityId) };
    }
    chatSessions.update(session.id, { categoryId: category.id, step: "AWAIT_QUESTION" });
    const hint = category.isSensitive
      ? "\n\nЭта тема конфиденциальна — вопрос увидят только специалисты вуза, а не случайные волонтёры."
      : "";
    return { text: `Категория: ${category.title}.${hint}\n\nНапишите ваш вопрос одним сообщением.` };
  }

  return startOrResetGreeting(externalChatId, channel);
}

/** Handles a free-text message: either a command, or (if AWAIT_QUESTION) the question itself. */
export async function handleTextMessage(
  channel: Channel,
  externalChatId: string,
  text: string,
  askerName?: string,
  askerUserId?: string
): Promise<EngineReply> {
  if (CMD_START.test(text)) {
    return startOrResetGreeting(externalChatId, channel, askerName);
  }

  const session = await getOrCreateSession(channel, externalChatId, askerName);

  if (CMD_CHANGE_UNIVERSITY.test(text)) {
    return startOrResetGreeting(externalChatId, channel, askerName);
  }

  if (session.step !== "AWAIT_QUESTION" || !session.universityId || !session.categoryId) {
    // Nudge the user back into the flow instead of dropping the message.
    return startOrResetGreeting(externalChatId, channel, askerName);
  }

  const category = categoriesStore.findById(session.categoryId);
  if (!category) return startOrResetGreeting(externalChatId, channel, askerName);

  const question = questionsStore.create({
    universityId: session.universityId,
    categoryId: session.categoryId,
    askerId: askerUserId || null,
    channel,
    externalChatId,
    askerName: askerName || session.askerName || "Гость",
    text,
    isSensitive: category.isSensitive,
    status: category.isSensitive ? "ESCALATED" : "PENDING",
  });

  // Reset to category selection so the same person can ask a follow-up
  // question in the same university without re-selecting it.
  chatSessions.update(session.id, { step: "SELECT_CATEGORY", categoryId: null });

  const eligible = await findEligibleExperts(session.universityId, session.categoryId);
  logger.info("question.created", { questionId: question.id, categoryId: category.code, eligibleCount: eligible.length });

  getIO().to(`university:${session.universityId}`).emit("question:new", {
    questionId: question.id,
    categoryId: category.id,
    categoryTitle: category.title,
    text: question.text,
    isSensitive: !!question.isSensitive,
    createdAt: question.createdAt,
  });

  const buttons = categoryButtons(session.universityId);
  const queueNote =
    eligible.length > 0
      ? "Вопрос отправлен доступным специалистам вуза — ответ придёт прямо в этот чат."
      : "Сейчас нет специалистов онлайн по этой теме, но вопрос сохранён и будет отвечен, как только кто-то из экспертов подключится.";

  return {
    text: `Спасибо! ${queueNote}\n\nМожете задать ещё один вопрос по другой теме:`,
    buttons,
    questionId: question.id,
  };
}
