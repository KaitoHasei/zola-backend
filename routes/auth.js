const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth");

router.route("/auth/register").post(authController.register);
router.route("/auth/login").post(authController.login);

module.exports = router;
