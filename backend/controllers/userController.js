const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");

exports.me = asyncHandler(async (req, res) => {
  res.json(req.user);
});

exports.updateMe = asyncHandler(async (req, res) => {
  const allowed = ["name", "about", "profilePicture", "notificationPrefs", "privacy"];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) req.user[key] = req.body[key];
  });
  await req.user.save();
  res.json(req.user);
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-notificationPrefs");
  if (!user) throw new ApiError(404, "User not found");
  res.json(user);
});

exports.searchUsers = asyncHandler(async (req, res) => {
  const q = req.query.q || "";
  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [{ phone: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { name: new RegExp(q, "i") }]
  })
    .select("name phone profilePicture about isOnline lastSeen")
    .limit(30);
  res.json(users);
});
