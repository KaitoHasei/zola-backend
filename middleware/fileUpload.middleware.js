const multer = require("multer");

const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
    cb(null, true);
  } else {
    cb(new multer.MulterError("not-support-type"), false);
  }
};

const uploadAvatar = multer({
  storage,
  limits: { fileSize: 180 * 180 * 5 },
  fileFilter: imageFilter,
}).single("avatar");

const avatarUploadMiddleware = (req, res, next) => {
  uploadAvatar(req, res, (error) => {
    if (error) {
      const { code } = error;
      if (code === "not-support-type")
        return res.status(403).json({ error: { code } });
      else if (code === "LIMIT_UNEXPECTED_FILE")
        return res.status(400).json({ error: { code: "unexpected-file" } });
      else if (code === "LIMIT_FILE_SIZE")
        return res.status(403).json({ error: { code: "avatar-limit-size " } });
      else
        return res
          .status(500)
          .json({ error: { code: "something went wrong!" } });
    }

    next();
  });
};

const uploadImages = multer({
  storage,
  fileFilter: imageFilter,
}).array("images", 6);

const imageUploadMiddleware = (req, res, next) => {
  uploadImages(req, res, (error) => {
    if (error) {
      const { code } = error;
      if (code === "not-support-type")
        return res.status(403).json({ error: { code } });
      else if (code === "LIMIT_UNEXPECTED_FILE")
        return res
          .status(400)
          .json({ error: { code: "limit-unexpected-file" } });
      else if (code === "LIMIT_FILE_SIZE")
        return res.status(403).json({ error: { code: "image-limit-size" } });
      else
        return res
          .status(500)
          .json({ error: { code: "something went wrong!" } });
    }

    next();
  });
};

exports.avatarUploadMiddleware = avatarUploadMiddleware;
exports.imageUploadMiddleware = imageUploadMiddleware;
