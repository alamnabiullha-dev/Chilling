const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/callService");

exports.list = asyncHandler(async (req, res) => {
  res.json(await service.listCalls(req.user._id));
});

exports.create = asyncHandler(async (req, res) => {
  const call = await service.createCall(req.user._id, req.body);
  call.participants.forEach((userId) => req.io?.to(`user:${userId}`).emit("call:ring", call));
  res.status(201).json(call);
});
