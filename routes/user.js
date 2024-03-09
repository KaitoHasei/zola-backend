const express = require("express");
const router = express.Router();

const {
  authenticationMiddleware,
} = require("../middleware/authentication.middleware");
const {
  avatarUploadMiddleware,
} = require("../middleware/fileUpload.middleware");
const userController = require("../controllers/user");

router.route("/users").get(authenticationMiddleware, userController.find);
router.route("/users/me").get(authenticationMiddleware, userController.me);
router
  .route("/users/avatar")
  .post(
    authenticationMiddleware,
    avatarUploadMiddleware,
    userController.uploadPhoto
  );

module.exports = router;
