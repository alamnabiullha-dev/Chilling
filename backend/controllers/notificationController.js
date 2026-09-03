const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/notificationService");

exports.list = asyncHandler(async (req, res) => {
  res.json(await service.listNotifications(req.user._id));
});

exports.read = asyncHandler(async (req, res) => {
  res.json(await service.markRead(req.user._id, req.params.id));
});
