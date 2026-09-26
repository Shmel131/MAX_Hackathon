import { Router } from "express";
import { config } from "../config";
import { sendMaxMessage, answerCallback } from "./client";
import { startOrResetWizard, handleButtonClick, handleTextMessage } from "../conversation/engine";
import { students } from "../db/store";
import { logger } from "../logger";

export const maxWebhookRouter = Router();

/**
 * Receives updates from MAX (webhook mode). Shape follows the common
 * {update_type, message | callback} envelope used by MAX/VK-style bot APIs.
 * Register this URL with the organizers' bot once a real token is issued
 * (see README "Подключение к MAX").
 *
 * Unlike the web app, a MAX user never has to "log in with a name" — their
 * platform identity (sender.user_id) is used to find-or-create their Student
 * record automatically, exactly as it would work in a shipped product.
 */
maxWebhookRouter.post("/webhook/max", async (req, res) => {
  if (config.maxWebhookSecret) {
    const provided = req.header("X-Max-Webhook-Secret");
    if (provided !== config.maxWebhookSecret) {
      return res.status(401).json({ error: "invalid webhook secret" });
    }
  }

  // Ack immediately — MAX (like most bot platforms) expects a fast 200.
  res.status(200).json({ ok: true });

  try {
    const update = req.body || {};
    const updateType: string = update.update_type || update.type || "";

    if (updateType.includes("callback")) {
      const chatId = String(update.callback?.chat_id ?? update.callback?.message?.recipient?.chat_id ?? "");
      const maxUserId = String(update.callback?.user?.user_id ?? "");
      const userName = update.callback?.user?.name || update.callback?.user?.first_name || "Пользователь МАХ";
      const buttonId = String(update.callback?.payload ?? update.callback?.callback_data ?? "");
      if (!chatId || !buttonId || !maxUserId) return;

      const student = students.findOrCreateByMaxUserId(maxUserId, userName);
      const reply = handleButtonClick("MAX", chatId, student.id, buttonId);
      if (update.callback?.callback_id) await answerCallback(update.callback.callback_id);
      await sendMaxMessage({ chatId, text: reply.text, buttons: reply.buttons });
      return;
    }

    if (updateType.includes("message")) {
      const message = update.message || {};
      const chatId = String(message.recipient?.chat_id ?? message.chat_id ?? "");
      const text: string = message.body?.text ?? message.text ?? "";
      const maxUserId = String(message.sender?.user_id ?? "");
      const userName = message.sender?.name || message.sender?.first_name || "Пользователь МАХ";
      if (!chatId || !maxUserId) return;

      const student = students.findOrCreateByMaxUserId(maxUserId, userName);
      const reply =
        text.trim() === "/start"
          ? startOrResetWizard(chatId, "MAX", student.id)
          : handleTextMessage("MAX", chatId, student.id, text);

      await sendMaxMessage({ chatId, text: reply.text, buttons: reply.buttons });
      return;
    }

    if (updateType.includes("bot_started") || updateType.includes("started")) {
      const chatId = String(update.chat_id ?? update.user?.chat_id ?? "");
      const maxUserId = String(update.user?.user_id ?? "");
      const userName = update.user?.name || update.user?.first_name || "Пользователь МАХ";
      if (!chatId || !maxUserId) return;
      const student = students.findOrCreateByMaxUserId(maxUserId, userName);
      const reply = startOrResetWizard(chatId, "MAX", student.id);
      await sendMaxMessage({ chatId, text: reply.text, buttons: reply.buttons });
      return;
    }

    logger.debug("max.unhandled_update", { updateType });
  } catch (err) {
    logger.error("max.webhook_error", { error: String(err) });
  }
});
