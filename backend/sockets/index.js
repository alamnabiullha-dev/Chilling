const socketAuth = require("./socketAuth");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const { createMessage, markDelivered, markRead } = require("../services/messageService");
const { createCall, finishCall } = require("../services/callService");
const { createNotification } = require("../services/notificationService");

const onlineUsers = new Map();

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    phone: user.phone,
    profilePicture: user.profilePicture,
    isOnline: true
  };
}

function registerSockets(io) {
  io.use(socketAuth);

  io.on("connection", async (socket) => {
    const userId = String(socket.user._id);
    onlineUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);
    socket.join("status");

    await User.findByIdAndUpdate(userId, { isOnline: true });
    socket.broadcast.emit("user:online", publicUser(socket.user));

    socket.on("conversation:join", async ({ conversationId }, ack) => {
      const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
      if (!conversation) return ack?.({ ok: false, message: "Unauthorized conversation" });
      socket.join(`conversation:${conversationId}`);
      await markDelivered(userId, conversationId);
      socket.to(`conversation:${conversationId}`).emit("message:delivered", { conversationId, userId });
      ack?.({ ok: true });
    });

    socket.on("conversation:leave", ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("message:send", async (payload, ack) => {
      try {
        const message = await createMessage(userId, payload);
        io.to(`conversation:${message.conversationId}`).emit("message:new", message);
        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, message: error.message });
      }
    });

    socket.on("message:read", async ({ conversationId }, ack) => {
      try {
        await markRead(userId, conversationId);
        io.to(`conversation:${conversationId}`).emit("message:read", { conversationId, userId });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: error.message });
      }
    });

    socket.on("typing:start", ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit("typing:start", { conversationId, user: publicUser(socket.user) });
    });

    socket.on("typing:stop", ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit("typing:stop", { conversationId, userId });
    });

    socket.on("call:initiate", async (payload, ack) => {
      try {
        const call = await createCall(userId, payload);
        const recipients = call.participants.map(String).filter((id) => id !== userId);
        recipients.forEach((recipientId) => {
          io.to(`user:${recipientId}`).emit("call:ring", { call, from: publicUser(socket.user) });
          createNotification(
            {
              user: recipientId,
              type: "call",
              title: `${payload.type === "video" ? "Video" : "Voice"} call`,
              message: `${socket.user.name || socket.user.phone} is calling`,
              relatedId: call._id
            },
            io
          );
        });
        ack?.({ ok: true, call });
      } catch (error) {
        ack?.({ ok: false, message: error.message });
      }
    });

    ["call:accept", "call:reject", "call:end", "webrtc:offer", "webrtc:answer", "webrtc:ice-candidate"].forEach((event) => {
      socket.on(event, async (payload = {}) => {
        const target = payload.to || payload.receiver;
        if (target) io.to(`user:${target}`).emit(event, { ...payload, from: userId });
        if (event === "call:end" || event === "call:reject") await finishCall(payload.callId, event === "call:reject" ? "rejected" : "ended");
      });
    });

    socket.on("disconnect", async () => {
      if (onlineUsers.get(userId) === socket.id) onlineUsers.delete(userId);
      const lastSeen = new Date();
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
      socket.broadcast.emit("user:offline", { userId, lastSeen });
      socket.broadcast.emit("user:lastSeen", { userId, lastSeen });
    });
  });
}

module.exports = registerSockets;
