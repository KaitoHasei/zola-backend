const express = require("express");
const router = express.Router();

const authenticationMiddleware = require("../middleware/authentication.middleware");
const userController = require("../controllers/user");

router.route("/user/me").get(authenticationMiddleware, userController.me);

module.exports = router;
