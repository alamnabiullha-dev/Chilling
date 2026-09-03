const router = require("express").Router();
const controller = require("../controllers/statusController");

router.post("/", controller.create);
router.get("/", controller.list);
router.put("/:id/view", controller.view);
router.delete("/:id", controller.remove);

module.exports = router;
