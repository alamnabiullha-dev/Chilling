const router = require("express").Router();
const controller = require("../controllers/uploadController");
const upload = require("../middleware/upload");

router.post("/", upload.single("file"), controller.upload);
router.get("/media/:filename", controller.media);

module.exports = router;
