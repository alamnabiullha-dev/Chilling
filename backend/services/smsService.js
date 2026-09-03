const env = require("../config/env");

async function sendOtpSms(phone, otp) {
  if (env.nodeEnv !== "production") {
    console.log(`[DEV OTP] ${phone}: ${otp}`);
    return { provider: "console", delivered: true };
  }

  if (!process.env.SMS_PROVIDER_API_KEY || !process.env.SMS_PROVIDER_SECRET) {
    throw new Error("SMS provider credentials are not configured");
  }

  // Replace this adapter with Twilio, MessageBird, SNS, or another production SMS provider.
  console.log(`Queued OTP for ${phone} with configured SMS provider`);
  return { provider: "configured", delivered: true };
}

module.exports = { sendOtpSms };
