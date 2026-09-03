const router = require("express").Router();
const controller = require("../controllers/groupController");

router.post("/", controller.create);
router.put("/:id", controller.update);
router.post("/:id/members", controller.addMember);
router.delete("/:id/members/:userId", controller.removeMember);

module.exports = router;
