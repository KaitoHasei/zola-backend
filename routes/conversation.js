const express = require("express");
const router = express.Router();

const {
  authenticationMiddleware,
} = require("../middleware/authentication.middleware");
const {
  imageUploadMiddleware,
} = require("../middleware/fileUpload.middleware");
const conversationController = require("../controllers/conversation");
const messageController = require("../controllers/message");

router
  .route("/conversations")
  .get(authenticationMiddleware, conversationController.list)
  .post(authenticationMiddleware, conversationController.post);

router
  .route("/conversations/:conversationId")
  .get(authenticationMiddleware, conversationController.get);

router
  .route("/conversations/:conversationId/messages")
  .get(authenticationMiddleware, messageController.get)
  .post(authenticationMiddleware, messageController.post);

// router
//   .route("/conversations/:conversationId/images")
//   .post(
//     authenticationMiddleware,
//     imageUploadMiddleware,
//     messageController.sendImages
//   );

module.exports = router;
