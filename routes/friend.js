const express = require("express");

const router = express.Router();

const {
  authenticationMiddleware,
} = require("../middleware/authentication.middleware");

const friendController = require("../controllers/friend");

router
  .route("/friends")
  .get(authenticationMiddleware, friendController.getContacts);

router
  .route("/friends/request")
  .post(authenticationMiddleware, friendController.sendFriendRequest);

router
  .route("/friends/search")
  .get(authenticationMiddleware, friendController.findFriend);
module.exports = router;
