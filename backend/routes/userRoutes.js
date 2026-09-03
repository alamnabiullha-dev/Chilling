const router = require("express").Router();
const controller = require("../controllers/userController");

router.get("/me", controller.me);
router.put("/me", controller.updateMe);
router.get("/search", controller.searchUsers);
router.get("/:id", controller.getUser);

module.exports = router;
