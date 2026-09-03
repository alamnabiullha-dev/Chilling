const User = require("../models/User");
const ApiError = require("../utils/apiError");
const { verifyToken } = require("../utils/jwt");

async function auth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : req.cookies?.token;
    if (!token) throw new ApiError(401, "Authentication required");

    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, "User no longer exists");

    req.user = user;
    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(401, "Invalid or expired token"));
  }
}

module.exports = auth;
