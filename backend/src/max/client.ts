import fetch from "node-fetch";
import { config } from "../config";
import { logger } from "../logger";
import { Button } from "../conversation/engine";

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
