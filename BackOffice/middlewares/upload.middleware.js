const multer = require("multer");
const path = require("path");
const fs = require("fs");

function createUploader(options = {}) {
  const folder = options.folder || "uploads";
  const allowedExtensions = options.allowedExtensions || ["jpg", "jpeg", "png", "webp"];
  const maxSize = options.maxSize || 2 * 1024 * 1024;

  const uploadDir = path.join(__dirname, "..", "public", folder);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination(req, file, cb) {
      cb(null, uploadDir);
    },

    filename(req, file, cb) {
      const extension = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, uniqueName + extension);
    },
  });

  function fileFilter(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase().replace(".", "");
    const mimeType = file.mimetype;

    const extensionAllowed = allowedExtensions.includes(extension);
    const isImage = mimeType.startsWith("image/");

    if (!extensionAllowed || !isImage) {
      return cb(new Error("Invalid File"));
    }

    cb(null, true);
  }

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSize,
    },
  });
}

module.exports = createUploader;