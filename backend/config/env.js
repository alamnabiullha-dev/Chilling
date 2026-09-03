
const path = require("path");
const dotenv = require("dotenv");

// Load .env files for local development
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Required environment variables in production
const requiredInProduction = [
  "MONGO_URI",
  "JWT_SECRET",
  "OTP_SECRET",
  "CLIENT_URL",
];

if (process.env.NODE_ENV === "production") {
  requiredInProduction.forEach((name) => {
    if (!process.env[name]) {
      throw new Error(
        `Missing required environment variable: ${name}`
      );
    }
  });
}

const env = {
  // Environment
  nodeEnv: process.env.NODE_ENV || "development",

  // Server
  port: Number(process.env.PORT || 5002),

  // MongoDB
  mongoUri: process.env.MONGO_URI,

  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  // OTP
  otpSecret: process.env.OTP_SECRET,
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES || 5),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),

  // URLs
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  serverUrl: process.env.SERVER_URL || "http://localhost:5002",

  // Upload
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 25),

  // Storage
  storageProvider: process.env.STORAGE_PROVIDER || "local",
};

module.exports = env;

