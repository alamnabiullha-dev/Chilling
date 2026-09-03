const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["private", "group"], required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    groupName: { type: String, trim: true, maxlength: 120, default: "" },
    groupImage: { type: String, default: "" },
    groupDescription: { type: String, trim: true, maxlength: 500, default: "" },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null }
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

module.exports = mongoose.model("Conversation", conversationSchema);
