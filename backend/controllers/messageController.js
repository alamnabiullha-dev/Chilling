const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/messageService");
const Conversation = require("../models/Conversation");
const { createNotification } = require("../services/notificationService");

async function broadcastMessage(io, event, conversationId, payload) {
  io?.to(`conversation:${conversationId}`).emit(event, payload);
}

exports.list = asyncHandler(async (req, res) => {
  res.json(await service.listMessages(req.user._id, req.params.conversationId));
});

exports.create = asyncHandler(async (req, res) => {
  const message = await service.createMessage(req.user._id, req.body);
  await broadcastMessage(req.io, "message:new", message.conversationId, message);

  const conversation = await Conversation.findById(message.conversationId);
  const recipients = conversation.participants.filter((id) => String(id) !== String(req.user._id));
  await Promise.all(
    recipients.map((user) =>
      createNotification(
        {
          user,
          type: conversation.type === "group" ? "group" : "message",
          title: conversation.type === "group" ? conversation.groupName || "Group message" : req.user.name || req.user.phone,
          message: message.text || `${message.messageType} message`,
          relatedId: message._id
        },
        req.io
      )
    )
  );

  res.status(201).json(message);
});

exports.update = asyncHandler(async (req, res) => {
  const message = await service.updateMessage(req.user._id, req.params.id, req.body.text);
  await broadcastMessage(req.io, "message:edit", message.conversationId, message);
  res.json(message);
});

exports.remove = asyncHandler(async (req, res) => {
  const message = await service.deleteMessage(req.user._id, req.params.id, req.body.everyone);
  await broadcastMessage(req.io, "message:delete", message.conversationId, message);
  res.json(message);
});

exports.react = asyncHandler(async (req, res) => {
  const message = await service.reactToMessage(req.user._id, req.params.id, req.body.emoji);
  await broadcastMessage(req.io, "message:reaction", message.conversationId, message);
  res.json(message);
});

exports.read = asyncHandler(async (req, res) => {
  await service.markRead(req.user._id, req.params.conversationId);
  await broadcastMessage(req.io, "message:read", req.params.conversationId, {
    conversationId: req.params.conversationId,
    userId: req.user._id
  });
  res.json({ ok: true });
});
