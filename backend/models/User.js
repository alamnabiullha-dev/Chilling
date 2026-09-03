const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 80, default: "" },
    phone: { type: String, required: true, unique: true, index: true, trim: true },
    profilePicture: { type: String, default: "" },
    about: { type: String, trim: true, maxlength: 180, default: "Available on Aurora" },
    lastSeen: { type: Date, default: null },
    isOnline: { type: Boolean, default: false },
    notificationPrefs: {
      messages: { type: Boolean, default: true },
      calls: { type: Boolean, default: true },
      status: { type: Boolean, default: true }
    },
    privacy: {
      lastSeen: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
      profilePhoto: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
      readReceipts: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
