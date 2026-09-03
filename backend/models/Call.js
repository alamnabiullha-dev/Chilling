const mongoose = require("mongoose");

const callSchema = new mongoose.Schema(
  {
    caller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", default: null },
    type: { type: String, enum: ["voice", "video"], required: true },
    status: {
      type: String,
      enum: ["ringing", "accepted", "rejected", "missed", "ended", "failed"],
      default: "ringing"
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    duration: { type: Number, default: 0 }
  },
  { timestamps: true }
);

callSchema.index({ participants: 1, createdAt: -1 });

module.exports = mongoose.model("Call", callSchema);
