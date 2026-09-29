import { io, Socket } from "socket.io-client";
import { API_BASE, getToken } from "./api";

let socket: Socket | null = null;

export function connectSocket(): Socket {
  const token = getToken();
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(API_BASE, { auth: { token } });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
