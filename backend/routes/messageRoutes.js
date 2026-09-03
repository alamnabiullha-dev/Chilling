const router = require("express").Router();
const controller = require("../controllers/messageController");
const validate = require("../middleware/validate");
const { createMessageRules } = require("../validators/messageValidators");

router.get("/:conversationId", controller.list);
router.post("/", createMessageRules, validate, controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);
router.post("/:id/reaction", controller.react);
router.put("/:conversationId/read", controller.read);

module.exports = router;
