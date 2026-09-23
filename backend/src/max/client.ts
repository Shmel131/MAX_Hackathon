import fetch from "node-fetch";
import { config } from "../config";
import { logger } from "../logger";
import { Button } from "../conversation/engine";

/**
 * Thin wrapper over the MAX Bot API.
 *
 * IMPORTANT (see README "Подключение к MAX"): endpoint paths below follow the
 * documented MAX Bot API conventions (token-authenticated REST calls to send
 * messages and inline keyboards, plus a webhook that receives updates). Because
 * the platform's API can change, verify the exact paths/payload shapes against
 * the current МАХ Bot API docs before pointing this at a real token — the brief
 * itself warns the docs "develop and update" and asks teams not to rely on
 * stale examples. Everything else in this service (routing, reputation,
 * database) is fully independent of this file.
 *
 * When config.mockMax is true (the default for local/demo use), no outbound
 * HTTP call is made — messages are logged and mirrored to the Chat Simulator
 * instead, per the brief's rule that mocked data/integrations must be clearly
 * labeled (Ограничения, п.10).
 */

interface SendMessageParams {
  chatId: string;
  text: string;
  buttons?: Button[];
}

export async function sendMaxMessage({ chatId, text, buttons }: SendMessageParams): Promise<void> {
  if (config.mockMax || !config.maxBotToken) {
    logger.info("max.mock_send", { chatId, text, buttons });
    return;
  }

  const keyboard = buttons?.length
    ? {
        inline_keyboard: [buttons.map((b) => ({ text: b.label, callback_data: b.id }))],
      }
    : undefined;

  const res = await fetch(`${config.maxApiBaseUrl}/messages?access_token=${config.maxBotToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      attachments: keyboard ? [{ type: "inline_keyboard", payload: keyboard }] : undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("max.send_failed", { status: res.status, body });
  }
}

export async function answerCallback(callbackId: string): Promise<void> {
  if (config.mockMax || !config.maxBotToken) {
    logger.info("max.mock_answer_callback", { callbackId });
    return;
  }
  await fetch(`${config.maxApiBaseUrl}/answers?access_token=${config.maxBotToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_id: callbackId }),
  }).catch((err) => logger.error("max.answer_callback_failed", { error: String(err) }));
}
