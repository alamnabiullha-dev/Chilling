const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const ApiError = require("../utils/apiError");
const { assertParticipant } = require("./conversationService");

async function listMessages(userId, conversationId) {
  await assertParticipant(conversationId, userId);
  return Message.find({ conversationId, deletedFor: { $ne: userId } })
    .populate("sender", "name phone profilePicture")
    .populate("replyTo")
    .sort({ createdAt: 1 })
    .limit(200);
}

async function createMessage(userId, payload) {
  const conversation = await assertParticipant(payload.conversationId, userId);
  const message = await Message.create({
    conversationId: payload.conversationId,
    sender: userId,
    messageType: payload.messageType || "text",
    text: payload.text || "",
    mediaUrl: payload.mediaUrl || "",
    fileName: payload.fileName || "",
    fileSize: payload.fileSize || 0,
    replyTo: payload.replyTo || null,
    location: payload.location,
    contact: payload.contact,
    deliveredTo: [userId],
    readBy: [userId],
    forwardedFrom: payload.forwardedFrom || null
  });

  conversation.lastMessage = message._id;
  await conversation.save();
  return message.populate("sender", "name phone profilePicture");
}

async function updateMessage(userId, messageId, text) {
  const message = await Message.findById(messageId);
  if (!message) throw new ApiError(404, "Message not found");
  if (String(message.sender) !== String(userId)) throw new ApiError(403, "Only the sender can edit this message");
  message.text = text;
  message.edited = true;
  message.editedAt = new Date();
  await message.save();
  return message.populate("sender", "name phone profilePicture");
}

async function deleteMessage(userId, messageId, everyone = false) {
  const message = await Message.findById(messageId);
  if (!message) throw new ApiError(404, "Message not found");
  await assertParticipant(message.conversationId, userId);
  if (everyone && String(message.sender) !== String(userId)) throw new ApiError(403, "Only the sender can delete for everyone");

  if (everyone) {
    message.text = "";
    message.mediaUrl = "";
    message.messageType = "text";
    message.deletedFor = [];
    message.edited = true;
  } else if (!message.deletedFor.map(String).includes(String(userId))) {
    message.deletedFor.push(userId);
  }
  await message.save();
  return message;
}

async function reactToMessage(userId, messageId, emoji) {
  const message = await Message.findById(messageId);
  if (!message) throw new ApiError(404, "Message not found");
  await assertParticipant(message.conversationId, userId);
  message.reactions = message.reactions.filter((reaction) => String(reaction.user) !== String(userId));
  if (emoji) message.reactions.push({ user: userId, emoji });
  await message.save();
  return message.populate("sender", "name phone profilePicture");
}

async function markRead(userId, conversationId) {
  await assertParticipant(conversationId, userId);
  await Message.updateMany(
    { conversationId, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId, deliveredTo: userId } }
  );
  return Conversation.findById(conversationId);
}

async function markDelivered(userId, conversationId) {
  await assertParticipant(conversationId, userId);
  await Message.updateMany(
    { conversationId, deliveredTo: { $ne: userId } },
    { $addToSet: { deliveredTo: userId } }
  );
}

module.exports = {
  listMessages,
  createMessage,
  updateMessage,
  deleteMessage,
  reactToMessage,
  markRead,
  markDelivered
};
