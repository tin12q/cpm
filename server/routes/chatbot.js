const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../helpers/roleValidator");
const { sendMessage } = require("../controller/ChatbotController");

router.post("/message", authenticate, requireRole({ collection: 0, task: 0 }), sendMessage);

module.exports = router;
