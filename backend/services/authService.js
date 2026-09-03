const Otp = require("../models/Otp");
const User = require("../models/User");
const ApiError = require("../utils/apiError");
const { generateOtp, hashOtp, normalizePhone } = require("../utils/otp");
const { signToken } = require("../utils/jwt");
const { sendOtpSms } = require("./smsService");
const env = require("../config/env");

async function sendOtp({ countryCode, phone }) {
  const normalized = normalizePhone(countryCode, phone);
  if (!normalized) throw new ApiError(422, "Enter a valid phone number");

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60 * 1000);

  await Otp.findOneAndUpdate(
    { phone: normalized },
    { phone: normalized, otpHash: hashOtp(normalized, otp), attempts: 0, expiresAt, lastSentAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await sendOtpSms(normalized, otp);

  return {
    phone: normalized,
    expiresAt,
    resendAfterSeconds: 45,
    devOtp: env.nodeEnv === "production" ? undefined : otp
  };
}

async function verifyOtp({ phone, otp }) {
  const normalized = normalizePhone("", phone);
  if (!normalized) throw new ApiError(422, "Enter a valid phone number");

  const record = await Otp.findOne({ phone: normalized });
  if (!record || record.expiresAt < new Date()) throw new ApiError(400, "OTP expired. Request a new code.");
  if (record.attempts >= env.otpMaxAttempts) throw new ApiError(429, "Maximum OTP attempts exceeded");

  const incomingHash = hashOtp(normalized, otp);
  if (incomingHash !== record.otpHash) {
    record.attempts += 1;
    await record.save();
    throw new ApiError(400, "Invalid OTP");
  }

  let user = await User.findOne({ phone: normalized });
  const isNewUser = !user;
  if (!user) user = await User.create({ phone: normalized });
  await Otp.deleteMany({ phone: normalized });

  return { user, token: signToken(user), requiresProfile: isNewUser || !user.name };
}

module.exports = { sendOtp, verifyOtp };
