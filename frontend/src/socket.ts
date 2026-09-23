import { io, Socket } from "socket.io-client";
import { API_BASE, getToken } from "./api";

let socket: Socket | null = null;

export function getExpertSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, { auth: { token: getToken() }, autoConnect: false });
  }
  return socket;
}

export function connectExpertSocket() {
  const s = getExpertSocket();
  s.auth = { token: getToken() };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectExpertSocket() {
  socket?.disconnect();
}

export function openSimulatorSocket(chatId: string): Socket {
  const s = io(API_BASE, { auth: { simulatorChatId: chatId } });
  return s;
}
