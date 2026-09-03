const Notification = require("../models/Notification");

async function createNotification(payload, io = null) {
  const notification = await Notification.create(payload);
  if (io) io.to(`user:${payload.user}`).emit("notification:new", notification);
  return notification;
}

async function listNotifications(userId) {
  return Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(100);
}

async function markRead(userId, notificationId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { isRead: true },
    { new: true }
  );
}

module.exports = { createNotification, listNotifications, markRead };
