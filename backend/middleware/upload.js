const path = require("path");
const multer = require("multer");
const { nanoid } = require("nanoid");
const env = require("../config/env");
const ApiError = require("../utils/apiError");

const allowedMime = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "../uploads/media"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 16);
    cb(null, `${Date.now()}-${nanoid(10)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) return cb(new ApiError(415, "Unsupported file type"));
    cb(null, true);
  }
});

module.exports = upload;
