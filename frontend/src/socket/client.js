import { io } from "socket.io-client";
import { API_URL } from "../services/api";

let socket;

export function getSocket() {
  const token = localStorage.getItem("aurora_token");
  if (!socket && token) {
    socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"]
    });
  }
  return socket;
}

export function resetSocket() {
  if (socket) socket.disconnect();
  socket = null;
}
