const socketAuth = require("./socketAuth");
const User = require("../models/User");
const Conversation = require("../models/Conversation");

const {
  createMessage,
  markDelivered,
  markRead
} = require("../services/messageService");

const {
  createCall,
  finishCall
} = require("../services/callService");

const {
  createNotification
} = require("../services/notificationService");

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

    console.log("================================");
    console.log("SOCKET CONNECTED");
    console.log("USER:", userId);
    console.log("SOCKET:", socket.id);
    console.log("================================");

    onlineUsers.set(userId, socket.id);

    socket.join(`user:${userId}`);
    socket.join("status");

    await User.findByIdAndUpdate(userId, {
      isOnline: true
    });

    socket.broadcast.emit(
      "user:online",
      publicUser(socket.user)
    );

    // =========================================
    // CONVERSATION JOIN
    // =========================================

    socket.on(
      "conversation:join",
      async ({ conversationId }, ack) => {
        try {
          const conversation =
            await Conversation.findOne({
              _id: conversationId,
              participants: userId
            });

          if (!conversation) {
            return ack?.({
              ok: false,
              message: "Unauthorized conversation"
            });
          }

          socket.join(
            `conversation:${conversationId}`
          );

          await markDelivered(
            userId,
            conversationId
          );

          socket
            .to(`conversation:${conversationId}`)
            .emit("message:delivered", {
              conversationId,
              userId
            });

          ack?.({
            ok: true
          });
        } catch (error) {
          console.error(
            "conversation:join error:",
            error
          );

          ack?.({
            ok: false,
            message: error.message
          });
        }
      }
    );

    // =========================================
    // CONVERSATION LEAVE
    // =========================================

    socket.on(
      "conversation:leave",
      ({ conversationId }) => {
        socket.leave(
          `conversation:${conversationId}`
        );
      }
    );

    // =========================================
    // MESSAGE SEND
    // =========================================

    socket.on(
      "message:send",
      async (payload, ack) => {
        try {
          const message = await createMessage(
            userId,
            payload
          );

          io
            .to(
              `conversation:${message.conversationId}`
            )
            .emit("message:new", message);

          ack?.({
            ok: true,
            message
          });
        } catch (error) {
          ack?.({
            ok: false,
            message: error.message
          });
        }
      }
    );

    // =========================================
    // MESSAGE READ
    // =========================================

    socket.on(
      "message:read",
      async ({ conversationId }, ack) => {
        try {
          await markRead(
            userId,
            conversationId
          );

          io
            .to(`conversation:${conversationId}`)
            .emit("message:read", {
              conversationId,
              userId
            });

          ack?.({
            ok: true
          });
        } catch (error) {
          ack?.({
            ok: false,
            message: error.message
          });
        }
      }
    );

    // =========================================
    // TYPING START
    // =========================================

    socket.on(
      "typing:start",
      ({ conversationId }) => {
        socket
          .to(`conversation:${conversationId}`)
          .emit("typing:start", {
            conversationId,
            user: publicUser(socket.user)
          });
      }
    );

    // =========================================
    // TYPING STOP
    // =========================================

    socket.on(
      "typing:stop",
      ({ conversationId }) => {
        socket
          .to(`conversation:${conversationId}`)
          .emit("typing:stop", {
            conversationId,
            userId
          });
      }
    );

    // =========================================
    // CALL INITIATE
    // =========================================

    socket.on(
      "call:initiate",
      async (payload, ack) => {
        try {
          console.log("================================");
          console.log("CALL INITIATE");
          console.log("FROM:", userId);
          console.log("PAYLOAD:", payload);
          console.log("================================");

          const call = await createCall(
            userId,
            payload
          );

          const recipients =
            call.participants
              .map(String)
              .filter(
                (id) => id !== userId
              );

          console.log(
            "CALL CREATED:",
            String(call._id)
          );

          console.log(
            "RECIPIENTS:",
            recipients
          );

          // Send incoming call to receiver
          recipients.forEach(
            (recipientId) => {
              io
                .to(`user:${recipientId}`)
                .emit("call:ring", {
                  call,
                  from: publicUser(
                    socket.user
                  )
                });

              createNotification(
                {
                  user: recipientId,
                  type: "call",
                  title:
                    payload.type === "video"
                      ? "Video call"
                      : "Voice call",
                  message: `${
                    socket.user.name ||
                    socket.user.phone
                  } is calling`,
                  relatedId: call._id
                },
                io
              );
            }
          );

          // IMPORTANT:
          // Return the created call with _id
          ack?.({
            ok: true,
            call
          });
        } catch (error) {
          console.error(
            "call:initiate error:",
            error
          );

          ack?.({
            ok: false,
            message: error.message
          });
        }
      }
    );

    // =========================================
    // CALL ACCEPT
    // =========================================

    socket.on(
      "call:accept",
      async (payload = {}) => {
        try {
          const callId =
            payload.callId ||
            payload.call?._id;

          const target =
            payload.to ||
            payload.receiver ||
            payload.from;

          console.log("================================");
          console.log("CALL ACCEPT");
          console.log("FROM:", userId);
          console.log("TO:", target);
          console.log("CALL ID:", callId);
          console.log("================================");

          if (!target) {
            console.log(
              "❌ CALL ACCEPT: target missing"
            );
            return;
          }

          io
            .to(`user:${String(target)}`)
            .emit("call:accept", {
              callId,
              from: userId,
              to: String(target)
            });
        } catch (error) {
          console.error(
            "call:accept error:",
            error
          );
        }
      }
    );

    // =========================================
    // CALL REJECT
    // =========================================

    socket.on(
      "call:reject",
      async (payload = {}) => {
        try {
          const callId =
            payload.callId ||
            payload.call?._id;

          const target =
            payload.to ||
            payload.receiver ||
            payload.from;

          console.log("================================");
          console.log("CALL REJECT");
          console.log("FROM:", userId);
          console.log("TO:", target);
          console.log("CALL ID:", callId);
          console.log("================================");

          if (target) {
            io
              .to(`user:${String(target)}`)
              .emit("call:reject", {
                callId,
                from: userId,
                to: String(target)
              });
          }

          if (callId) {
            await finishCall(
              callId,
              "rejected"
            );
          }
        } catch (error) {
          console.error(
            "call:reject error:",
            error
          );
        }
      }
    );

    // =========================================
    // WEBRTC OFFER
    // =========================================

    socket.on(
      "webrtc:offer",
      (payload = {}) => {
        try {
          const {
            offer,
            callId
          } = payload;

          const target =
            payload.to ||
            payload.receiver;

          console.log("================================");
          console.log("WEBRTC OFFER");
          console.log("FROM:", userId);
          console.log("TO:", target);
          console.log("CALL ID:", callId);
          console.log(
            "HAS OFFER:",
            !!offer
          );
          console.log("================================");

          if (!target) {
            console.log(
              "❌ WEBRTC OFFER: target missing"
            );
            return;
          }

          if (!offer) {
            console.log(
              "❌ WEBRTC OFFER: offer missing"
            );
            return;
          }

          io
            .to(`user:${String(target)}`)
            .emit("webrtc:offer", {
              callId,
              offer,
              from: userId,
              to: String(target)
            });
        } catch (error) {
          console.error(
            "webrtc:offer error:",
            error
          );
        }
      }
    );

    // =========================================
    // WEBRTC ANSWER
    // =========================================

    socket.on(
      "webrtc:answer",
      (payload = {}) => {
        try {
          const {
            answer,
            callId
          } = payload;

          const target =
            payload.to ||
            payload.receiver;

          console.log("================================");
          console.log("WEBRTC ANSWER");
          console.log("FROM:", userId);
          console.log("TO:", target);
          console.log("CALL ID:", callId);
          console.log(
            "HAS ANSWER:",
            !!answer
          );
          console.log("================================");

          if (!target) {
            console.log(
              "❌ WEBRTC ANSWER: target missing"
            );
            return;
          }

          if (!answer) {
            console.log(
              "❌ WEBRTC ANSWER: answer missing"
            );
            return;
          }

          io
            .to(`user:${String(target)}`)
            .emit("webrtc:answer", {
              callId,
              answer,
              from: userId,
              to: String(target)
            });
        } catch (error) {
          console.error(
            "webrtc:answer error:",
            error
          );
        }
      }
    );

    // =========================================
    // WEBRTC ICE CANDIDATE
    // =========================================

    socket.on(
      "webrtc:ice-candidate",
      (payload = {}) => {
        try {
          const {
            candidate,
            callId
          } = payload;

          const target =
            payload.to ||
            payload.receiver;

          console.log("================================");
          console.log("WEBRTC ICE CANDIDATE");
          console.log("FROM:", userId);
          console.log("TO:", target);
          console.log("CALL ID:", callId);
          console.log(
            "HAS CANDIDATE:",
            !!candidate
          );
          console.log("================================");

          if (!target) {
            console.log(
              "❌ ICE: target missing"
            );
            return;
          }

          if (!candidate) {
            console.log(
              "❌ ICE: candidate missing"
            );
            return;
          }

          io
            .to(`user:${String(target)}`)
            .emit(
              "webrtc:ice-candidate",
              {
                callId,
                candidate,
                from: userId,
                to: String(target)
              }
            );
        } catch (error) {
          console.error(
            "webrtc:ice-candidate error:",
            error
          );
        }
      }
    );

    // =========================================
    // CALL END
    // =========================================

    socket.on(
      "call:end",
      async (payload = {}) => {
        try {
          const callId =
            payload.callId ||
            payload.call?._id;

          const target =
            payload.to ||
            payload.receiver ||
            payload.from;

          console.log("================================");
          console.log("CALL END");
          console.log("FROM:", userId);
          console.log("TO:", target);
          console.log("CALL ID:", callId);
          console.log("================================");

          if (target) {
            io
              .to(`user:${String(target)}`)
              .emit("call:end", {
                callId,
                from: userId,
                to: String(target)
              });
          }

          if (callId) {
            await finishCall(
              callId,
              "ended"
            );
          }
        } catch (error) {
          console.error(
            "call:end error:",
            error
          );
        }
      }
    );

    // =========================================
    // DISCONNECT
    // =========================================

    socket.on(
      "disconnect",
      async () => {
        try {
          console.log("================================");
          console.log("SOCKET DISCONNECTED");
          console.log("USER:", userId);
          console.log("SOCKET:", socket.id);
          console.log("================================");

          if (
            onlineUsers.get(userId) ===
            socket.id
          ) {
            onlineUsers.delete(userId);
          }

          const lastSeen =
            new Date();

          await User.findByIdAndUpdate(
            userId,
            {
              isOnline: false,
              lastSeen
            }
          );

          socket.broadcast.emit(
            "user:offline",
            {
              userId,
              lastSeen
            }
          );

          socket.broadcast.emit(
            "user:lastSeen",
            {
              userId,
              lastSeen
            }
          );
        } catch (error) {
          console.error(
            "disconnect error:",
            error
          );
        }
      }
    );
  });
}

module.exports = registerSockets;
