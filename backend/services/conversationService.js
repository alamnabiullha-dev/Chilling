const Conversation = require("../models/Conversation");
const User = require("../models/User");
const ApiError = require("../utils/apiError");

async function assertParticipant(conversationId, userId) {
  const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
  if (!conversation) throw new ApiError(403, "You do not have access to this conversation");
  return conversation;
}

async function listConversations(userId) {
  return Conversation.find({ participants: userId })
    .populate("participants", "name phone profilePicture about isOnline lastSeen")
    .populate({ path: "lastMessage", populate: { path: "sender", select: "name phone profilePicture" } })
    .sort({ updatedAt: -1 });
}

async function createConversation(userId, payload) {
  const type = payload.type || "private";
  const participantIds = Array.from(new Set([String(userId), ...(payload.participants || []).map(String)]));

  if (type === "private") {
    if (participantIds.length !== 2) throw new ApiError(422, "Private chats require exactly two participants");
    const existing = await Conversation.findOne({
      type: "private",
      participants: { $all: participantIds, $size: 2 }
    });
    if (existing) return existing.populate("participants", "name phone profilePicture about isOnline lastSeen");
  }

  const found = await User.countDocuments({ _id: { $in: participantIds } });
  if (found !== participantIds.length) throw new ApiError(422, "One or more participants do not exist");

  const conversation = await Conversation.create({
    type,
    participants: participantIds,
    groupName: type === "group" ? payload.groupName : "",
    groupDescription: payload.groupDescription || "",
    groupImage: payload.groupImage || "",
    admins: type === "group" ? [userId] : []
  });

  return conversation.populate("participants", "name phone profilePicture about isOnline lastSeen");
}

async function updateGroup(userId, groupId, updates) {
  const group = await Conversation.findOne({ _id: groupId, type: "group", participants: userId });
  if (!group) throw new ApiError(404, "Group not found");
  if (!group.admins.map(String).includes(String(userId))) throw new ApiError(403, "Only admins can update this group");

  ["groupName", "groupDescription", "groupImage"].forEach((key) => {
    if (updates[key] !== undefined) group[key] = updates[key];
  });
  await group.save();
  return group.populate("participants", "name phone profilePicture");
}

async function addGroupMember(userId, groupId, memberId) {
  const group = await Conversation.findOne({ _id: groupId, type: "group", participants: userId });
  if (!group) throw new ApiError(404, "Group not found");
  if (!group.admins.map(String).includes(String(userId))) throw new ApiError(403, "Only admins can add members");
  if (!group.participants.map(String).includes(String(memberId))) group.participants.push(memberId);
  await group.save();
  return group;
}

async function removeGroupMember(userId, groupId, memberId) {
  const group = await Conversation.findOne({ _id: groupId, type: "group", participants: userId });
  if (!group) throw new ApiError(404, "Group not found");
  const isSelf = String(userId) === String(memberId);
  if (!isSelf && !group.admins.map(String).includes(String(userId))) throw new ApiError(403, "Only admins can remove members");
  group.participants = group.participants.filter((id) => String(id) !== String(memberId));
  group.admins = group.admins.filter((id) => String(id) !== String(memberId));
  await group.save();
  return group;
}

module.exports = {
  assertParticipant,
  listConversations,
  createConversation,
  updateGroup,
  addGroupMember,
  removeGroupMember
};
