const router = require("express").Router();
const controller = require("../controllers/callController");

router.get("/", controller.list);
router.post("/", controller.create);

module.exports = router;
