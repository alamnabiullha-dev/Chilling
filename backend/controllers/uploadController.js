const path = require("path");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");

exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");
  res.status(201).json({
    url: `/api/upload/media/${req.file.filename}`,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype
  });
});

exports.media = asyncHandler(async (req, res) => {
  const safeName = path.basename(req.params.filename);
  res.sendFile(path.resolve(__dirname, "../uploads/media", safeName));
});
