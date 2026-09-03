const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/conversationService");

exports.list = asyncHandler(async (req, res) => {
  res.json(await service.listConversations(req.user._id));
});

exports.create = asyncHandler(async (req, res) => {
  const conversation = await service.createConversation(req.user._id, req.body);
  conversation.participants.forEach((participant) => {
    req.io?.to(`user:${participant._id || participant}`).emit("conversation:new", conversation);
  });
  res.status(201).json(conversation);
});

exports.get = asyncHandler(async (req, res) => {
  const conversation = await service.assertParticipant(req.params.id, req.user._id);
  await conversation.populate("participants", "name phone profilePicture about isOnline lastSeen");
  res.json(conversation);
});
