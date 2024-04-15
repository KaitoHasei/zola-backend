const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contact");
const {
  authenticationMiddleware,
} = require("../middleware/authentication.middleware");

router.route("/contacts")
  .get(authenticationMiddleware, contactController.getAllContact);

router.route("/contacts/send-request")
  .post(authenticationMiddleware, contactController.sendFriendRequest);

router.route("/contacts/acept-request")
  .post(authenticationMiddleware, contactController.aceptFriendRequest);

router.route("/contacts/get-friends")
  .get(authenticationMiddleware, contactController.getAllFriendUser);

router.route("/contacts/get-friends-request")
  .get(authenticationMiddleware, contactController.getFriendRequestUser);

  router.route("/contacts/remove-friend")
  .post(authenticationMiddleware, contactController.removeFriend);
  module.exports = router;