import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { users } from "../db/store";
import { logger } from "../logger";
import { JwtPayload } from "../types";

let io: Server | null = null;

export function initSockets(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigin, credentials: true },
  });

  io.on("connection", (socket: Socket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const simulatorChatId = socket.handshake.auth?.simulatorChatId as string | undefined;

    if (token) {
      try {
        const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
        socket.data.userId = payload.userId;
        if (payload.universityId) {
          socket.join(`university:${payload.universityId}`);
        }
        users.setOnline(payload.userId, true);
        logger.info("socket.expert_connected", { userId: payload.userId });

        socket.on("disconnect", () => {
          users.setOnline(payload.userId, false);
          logger.info("socket.expert_disconnected", { userId: payload.userId });
        });
      } catch (err) {
        logger.warn("socket.auth_failed", { error: String(err) });
        socket.disconnect(true);
        return;
      }
    } else if (simulatorChatId) {
      // Anonymous asker session in the browser Chat Simulator — joins its own
      // private room so answers can be pushed back to exactly this browser tab.
      socket.join(`chat:${simulatorChatId}`);
    }
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO server not initialized yet");
  return io;
}

export function emitAnswerToChat(externalChatId: string, payload: unknown) {
  getIO().to(`chat:${externalChatId}`).emit("question:answered", payload);
}
