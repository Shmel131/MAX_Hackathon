import { io, Socket } from "socket.io-client";
import { API_BASE, getToken } from "./api";

let socket: Socket | null = null;

/** One shared socket for the whole app — the server figures out from the JWT
 * whether this is a staff/expert connection (joins its university room) or a
 * student connection (joins its own private room). */
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
