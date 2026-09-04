var express = require("express");
var router = express.Router();
const authController = require("../controllers/authController");
const { redirectIfAuthenticated } = require("../middlewares/auth.middleware");

router.get("/login", redirectIfAuthenticated, authController.login);
router.post("/login", redirectIfAuthenticated, authController.submittedLogin);

router.get("/register", redirectIfAuthenticated, authController.createLogin);
router.post(
  "/register",
  redirectIfAuthenticated,
  authController.createLoginSubmitted,
);

router.get("/logout", authController.logout);

module.exports = router;
