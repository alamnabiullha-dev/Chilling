const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    messageType: {
      type: String,
      enum: ["text", "image", "video", "audio", "voice", "document", "location", "contact"],
      default: "text"
    },
    text: { type: String, trim: true, maxlength: 5000, default: "" },
    mediaUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    reactions: [reactionSchema],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    location: {
      lat: Number,
      lng: Number,
      label: String
    },
    contact: {
      name: String,
      phone: String
    }
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
