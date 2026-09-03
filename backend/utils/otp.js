const crypto = require("crypto");
const env = require("../config/env");

function generateOtp() {
  if (env.nodeEnv !== "production" && process.env.DEV_OTP) return process.env.DEV_OTP;
  return String(crypto.randomInt(100000, 999999));
}

function hashOtp(phone, otp) {
  return crypto
    .createHmac("sha256", env.otpSecret)
    .update(`${phone}:${otp}`)
    .digest("hex");
}

function normalizePhone(countryCode, phone) {
  const digits = `${countryCode || ""}${phone || ""}`.replace(/[^\d+]/g, "");
  const prefixed = digits.startsWith("+") ? digits : `+${digits}`;
  if (!/^\+\d{8,16}$/.test(prefixed)) return "";
  return prefixed;
}

module.exports = { generateOtp, hashOtp, normalizePhone };
