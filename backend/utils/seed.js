require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Call = require("../models/Call");
const Status = require("../models/Status");

async function seed() {
  await connectDB();
  await Promise.all([
    User.deleteMany({ phone: { $in: ["+15550000001", "+15550000002", "+15550000003"] } }),
    Conversation.deleteMany({ groupName: "Aurora Launch Team" })
  ]);

  const [ada, linus, grace] = await User.create([
    { name: "Ada Stone", phone: "+15550000001", about: "Designing calm chat systems." },
    { name: "Linus Vale", phone: "+15550000002", about: "Ships real-time features." },
    { name: "Grace Park", phone: "+15550000003", about: "Always up for a video call." }
  ]);

  const privateChat = await Conversation.create({
    type: "private",
    participants: [ada._id, linus._id]
  });

  const group = await Conversation.create({
    type: "group",
    groupName: "Aurora Launch Team",
    groupDescription: "Product, engineering, and support.",
    participants: [ada._id, linus._id, grace._id],
    admins: [ada._id]
  });

  const messages = await Message.create([
    {
      conversationId: privateChat._id,
      sender: ada._id,
      messageType: "text",
      text: "Morning. Presence and typing indicators are looking good.",
      deliveredTo: [ada._id, linus._id],
      readBy: [ada._id, linus._id]
    },
    {
      conversationId: privateChat._id,
      sender: linus._id,
      messageType: "text",
      text: "Nice. I will test the WebRTC call path next.",
      deliveredTo: [ada._id, linus._id],
      readBy: [ada._id]
    },
    {
      conversationId: group._id,
      sender: grace._id,
      messageType: "text",
      text: "The group chat has admin controls and live rooms now.",
      deliveredTo: [ada._id, linus._id, grace._id],
      readBy: [grace._id]
    }
  ]);

  privateChat.lastMessage = messages[1]._id;
  group.lastMessage = messages[2]._id;
  await Promise.all([privateChat.save(), group.save()]);

  await Call.create({
    caller: linus._id,
    receiver: ada._id,
    participants: [linus._id, ada._id],
    type: "voice",
    status: "ended",
    endedAt: new Date(),
    duration: 142
  });

  await Status.create({
    user: grace._id,
    type: "text",
    text: "Aurora demo data is live for the next 24 hours.",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  console.log("Seeded demo users:");
  console.log("+15550000001 Ada Stone");
  console.log("+15550000002 Linus Vale");
  console.log("+15550000003 Grace Park");
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
