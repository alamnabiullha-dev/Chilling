const router = require("express").Router();
const auth = require("../middleware/auth");

router.use("/auth", require("./authRoutes"));
router.use("/users", auth, require("./userRoutes"));
router.use("/contacts", auth, require("./contactRoutes"));
router.use("/conversations", auth, require("./conversationRoutes"));
router.use("/messages", auth, require("./messageRoutes"));
router.use("/groups", auth, require("./groupRoutes"));
router.use("/status", auth, require("./statusRoutes"));
router.use("/calls", auth, require("./callRoutes"));
router.use("/notifications", auth, require("./notificationRoutes"));
router.use("/upload", auth, require("./uploadRoutes"));

module.exports = router;
