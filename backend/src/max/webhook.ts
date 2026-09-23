import { Router } from "express";
import { config } from "../config";
import { sendMaxMessage, answerCallback } from "./client";
import { handleButtonClick, handleTextMessage, startOrResetGreeting } from "../conversation/engine";
import { logger } from "../logger";

export const maxWebhookRouter = Router();

/**
 * Receives updates from MAX (webhook mode). Shape follows the common
 * {update_type, message | callback} envelope used by MAX/VK-style bot APIs.
 * Register this URL with the organizers' bot once a real token is issued
 * (see README "Подключение к MAX").
 */
maxWebhookRouter.post("/webhook/max", async (req, res) => {
  // Optional shared-secret check if MAX_WEBHOOK_SECRET is configured.
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
      const userName = update.callback?.user?.name || update.callback?.user?.first_name;
      const buttonId = String(update.callback?.payload ?? update.callback?.callback_data ?? "");
      if (!chatId || !buttonId) return;

      const reply = await handleButtonClick("MAX", chatId, buttonId);
      if (update.callback?.callback_id) await answerCallback(update.callback.callback_id);
      await sendMaxMessage({ chatId, text: reply.text, buttons: reply.buttons });
      return;
    }

    if (updateType.includes("message")) {
      const message = update.message || {};
      const chatId = String(message.recipient?.chat_id ?? message.chat_id ?? "");
      const text: string = message.body?.text ?? message.text ?? "";
      const userName = message.sender?.name || message.sender?.first_name || "Пользователь МАХ";
      const userId = message.sender?.user_id ? String(message.sender.user_id) : undefined;
      if (!chatId) return;

      const reply = text.trim() === "/start"
        ? await startOrResetGreeting(chatId, "MAX", userName)
        : await handleTextMessage("MAX", chatId, text, userName, userId);

      await sendMaxMessage({ chatId, text: reply.text, buttons: reply.buttons });
      return;
    }

    if (updateType.includes("bot_started") || updateType.includes("started")) {
      const chatId = String(update.chat_id ?? update.user?.chat_id ?? "");
      const userName = update.user?.name || update.user?.first_name;
      if (!chatId) return;
      const reply = await startOrResetGreeting(chatId, "MAX", userName);
      await sendMaxMessage({ chatId, text: reply.text, buttons: reply.buttons });
      return;
    }

    logger.debug("max.unhandled_update", { updateType });
  } catch (err) {
    logger.error("max.webhook_error", { error: String(err) });
  }
});
