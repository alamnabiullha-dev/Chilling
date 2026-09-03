const router = require("express").Router();
const controller = require("../controllers/notificationController");

router.get("/", controller.list);
router.put("/:id/read", controller.read);

module.exports = router;
