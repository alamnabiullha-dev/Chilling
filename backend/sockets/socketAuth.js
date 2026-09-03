const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");

async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
    if (!token) return next(new Error("Authentication required"));
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (!user) return next(new Error("User not found"));
    socket.user = user;
    next();
  } catch (_error) {
    next(new Error("Invalid socket token"));
  }
}

module.exports = socketAuth;
