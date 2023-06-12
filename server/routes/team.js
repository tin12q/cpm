const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require('../helpers/roleValidator');
const { getTeams } = require('../controller/TeamController');


router.get("/", authenticate, requireRole({ collection: 3, task: 0 }), getTeams);

module.exports = router;
