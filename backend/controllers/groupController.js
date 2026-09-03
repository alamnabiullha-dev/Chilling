const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/conversationService");

exports.create = asyncHandler(async (req, res) => {
  const group = await service.createConversation(req.user._id, { ...req.body, type: "group" });
  req.io?.to(`conversation:${group._id}`).emit("group:update", group);
  res.status(201).json(group);
});

exports.update = asyncHandler(async (req, res) => {
  const group = await service.updateGroup(req.user._id, req.params.id, req.body);
  req.io?.to(`conversation:${group._id}`).emit("group:update", group);
  res.json(group);
});

exports.addMember = asyncHandler(async (req, res) => {
  const group = await service.addGroupMember(req.user._id, req.params.id, req.body.userId);
  req.io?.to(`conversation:${group._id}`).emit("group:update", group);
  res.json(group);
});

exports.removeMember = asyncHandler(async (req, res) => {
  const group = await service.removeGroupMember(req.user._id, req.params.id, req.params.userId);
  req.io?.to(`conversation:${group._id}`).emit("group:update", group);
  res.json(group);
});
