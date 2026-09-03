import { io } from "socket.io-client";
import { API_URL } from "../services/api";

let socket = null;

export function getSocket() {
  const token = localStorage.getItem("aurora_token");

  if (!token) {
    console.warn("⚠️ No aurora_token found");
    return null;
  }

  if (!socket) {
    socket = io(API_URL, {
      auth: {
        token,
      },

      transports: ["websocket", "polling"],

      withCredentials: true,

      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("🟢 Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔴 Socket disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message);
    });
  }

  return socket;
}

export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default getSocket;
