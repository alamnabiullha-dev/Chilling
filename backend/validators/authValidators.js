const { body } = require("express-validator");

exports.sendOtpRules = [
  body("countryCode").optional().isString().isLength({ min: 1, max: 5 }),
  body("phone").isString().isLength({ min: 6, max: 20 })
];

exports.verifyOtpRules = [
  body("phone").isString().isLength({ min: 8, max: 20 }),
  body("otp").isString().matches(/^\d{6}$/).withMessage("OTP must be 6 digits")
];
