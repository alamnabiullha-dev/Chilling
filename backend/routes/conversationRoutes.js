const router = require("express").Router();
const controller = require("../controllers/conversationController");
const validate = require("../middleware/validate");
const { createConversationRules } = require("../validators/conversationValidators");

router.get("/", controller.list);
router.post("/", createConversationRules, validate, controller.create);
router.get("/:id", controller.get);

module.exports = router;
