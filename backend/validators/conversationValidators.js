const { body } = require("express-validator");

exports.createConversationRules = [
  body("type").optional().isIn(["private", "group"]),
  body("participants").isArray({ min: 1 }),
  body("participants.*").isMongoId(),
  body("groupName").optional().isString().isLength({ max: 120 }),
  body("groupDescription").optional().isString().isLength({ max: 500 })
];
