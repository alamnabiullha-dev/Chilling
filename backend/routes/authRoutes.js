const router = require("express").Router();
const controller = require("../controllers/authController");
const validate = require("../middleware/validate");
const { otpLimiter } = require("../middleware/rateLimiters");
const { sendOtpRules, verifyOtpRules } = require("../validators/authValidators");

router.post("/send-otp", otpLimiter, sendOtpRules, validate, controller.sendOtp);
router.post("/verify-otp", verifyOtpRules, validate, controller.verifyOtp);
router.post("/logout", controller.logout);

module.exports = router;
