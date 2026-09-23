import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { startOrResetGreeting, handleButtonClick, handleTextMessage } from "../conversation/engine";

/**
 * Browser "Chat Simulator" — drives the exact same conversation engine that
 * the real MAX webhook uses (src/max/webhook.ts), so this is a faithful
 * stand-in for the MAX chat-bot UX when a reviewer doesn't have a live MAX
 * bot token connected yet. See README "Как проверить без токена МАХ".
 */
export const simulatorRouter = Router();

simulatorRouter.post(
  "/simulator/start",
  asyncHandler(async (req, res) => {
    const { chatId, name } = z.object({ chatId: z.string().min(1), name: z.string().optional() }).parse(req.body);
    const reply = await startOrResetGreeting(chatId, "SIMULATOR", name);
    res.json(reply);
  })
);

simulatorRouter.post(
  "/simulator/click",
  asyncHandler(async (req, res) => {
    const { chatId, buttonId } = z.object({ chatId: z.string().min(1), buttonId: z.string().min(1) }).parse(req.body);
    const reply = await handleButtonClick("SIMULATOR", chatId, buttonId);
    res.json(reply);
  })
);

simulatorRouter.post(
  "/simulator/message",
  asyncHandler(async (req, res) => {
    const { chatId, text, name } = z
      .object({ chatId: z.string().min(1), text: z.string().min(1), name: z.string().optional() })
      .parse(req.body);
    const reply = await handleTextMessage("SIMULATOR", chatId, text, name);
    res.json(reply);
  })
);
