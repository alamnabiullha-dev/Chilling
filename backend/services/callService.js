const Call = require("../models/Call");

async function createCall(userId, payload) {
  return Call.create({
    caller: userId,
    receiver: payload.receiver || null,
    participants: Array.from(new Set([String(userId), ...(payload.participants || []), payload.receiver].filter(Boolean))),
    conversationId: payload.conversationId || null,
    type: payload.type,
    status: payload.status || "ringing"
  });
}

async function listCalls(userId) {
  return Call.find({ participants: userId })
    .populate("caller receiver participants", "name phone profilePicture")
    .sort({ createdAt: -1 })
    .limit(100);
}

async function finishCall(callId, status = "ended") {
  const call = await Call.findById(callId);
  if (!call) return null;
  call.status = status;
  call.endedAt = new Date();
  call.duration = Math.max(0, Math.round((call.endedAt - call.startedAt) / 1000));
  await call.save();
  return call;
}

module.exports = { createCall, listCalls, finishCall };
