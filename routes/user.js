const express = require("express");
const router = express.Router();

const userController = require("../controller/UserController");

router.post("/signup", userController.signUp);
router.post("/signin", userController.signIn);
module.exports = router;
