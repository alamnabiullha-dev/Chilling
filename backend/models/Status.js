const mongoose = require("mongoose");

const statusSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["text", "image", "video"], required: true },
    text: { type: String, trim: true, maxlength: 700, default: "" },
    mediaUrl: { type: String, default: "" },
    viewers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        viewedAt: { type: Date, default: Date.now }
      }
    ],
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
statusSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Status", statusSchema);
