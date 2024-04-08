const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth");

router.route("/auth/register").post(authController.register);
router.route("/auth/login").post(authController.login);
/* router.route("/auth/change-password").post(authController.changePassword) */

module.exports = router;
