const express = require("express");
const router = express.Router();
const { login, register } = require("../controller/Auth");

router.use("/login")