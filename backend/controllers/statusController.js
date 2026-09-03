const Status = require("../models/Status");
const asyncHandler = require("../utils/asyncHandler");

exports.create = asyncHandler(async (req, res) => {
  const status = await Status.create({
    user: req.user._id,
    type: req.body.type,
    text: req.body.text || "",
    mediaUrl: req.body.mediaUrl || "",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });
  req.io?.to("status").emit("status:new", status);
  res.status(201).json(status);
});

exports.list = asyncHandler(async (_req, res) => {
  const statuses = await Status.find({ expiresAt: { $gt: new Date() } })
    .populate("user", "name phone profilePicture")
    .sort({ createdAt: -1 });
  res.json(statuses);
});

exports.view = asyncHandler(async (req, res) => {
  const status = await Status.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { viewers: { user: req.user._id, viewedAt: new Date() } } },
    { new: true }
  );
  res.json(status);
});

exports.remove = asyncHandler(async (req, res) => {
  await Status.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ ok: true });
});
