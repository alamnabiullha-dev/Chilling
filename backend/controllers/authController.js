const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/authService");

exports.sendOtp = asyncHandler(async (req, res) => {
  const result = await authService.sendOtp(req.body);
  res.json(result);
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyOtp(req.body);
  res.cookie("token", result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.json(result);
});

exports.logout = asyncHandler(async (_req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});
