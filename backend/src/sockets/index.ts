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
    if (!token) {
      // Unauthenticated sockets are allowed to connect but join no rooms —
      // they simply won't receive any push events.
      return;
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    } catch (err) {
      logger.warn("socket.auth_failed", { error: String(err) });
      socket.disconnect(true);
      return;
    }

    if (payload.kind === "staff" && payload.userId) {
      const userId = payload.userId;
      if (payload.universityId) socket.join(`university:${payload.universityId}`);
      users.setOnline(userId, true);
      logger.info("socket.staff_connected", { userId });
      socket.on("disconnect", () => {
        users.setOnline(userId, false);
        logger.info("socket.staff_disconnected", { userId });
      });
    } else if (payload.kind === "student" && payload.studentId) {
      socket.join(`student:${payload.studentId}`);
      logger.info("socket.student_connected", { studentId: payload.studentId });
    }
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO server not initialized yet");
  return io;
}

export function emitToStudent(studentId: string, event: string, payload: unknown) {
  getIO().to(`student:${studentId}`).emit(event, payload);
}

export function emitToUniversity(universityId: string, event: string, payload: unknown) {
  getIO().to(`university:${universityId}`).emit(event, payload);
}
