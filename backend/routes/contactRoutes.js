const router = require("express").Router();
const controller = require("../controllers/userController");

router.get("/", controller.searchUsers);

module.exports = router;
