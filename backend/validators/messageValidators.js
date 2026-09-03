const { body } = require("express-validator");

exports.createMessageRules = [
  body("conversationId").isMongoId(),
  body("messageType")
    .optional()
    .isIn(["text", "image", "video", "audio", "voice", "document", "location", "contact"]),
  body("text").optional().isString().isLength({ max: 5000 }),
  body("mediaUrl").optional().isString().isLength({ max: 500 }),
  body("replyTo").optional({ nullable: true }).isMongoId()
];
