const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require('../helpers/roleValidator');
const { getTeams, getTeamWithId } = require('../controller/TeamController');


router.get('/:id', authenticate, requireRole({ collection: 3, task: 0 }), getTeamWithId);
router.get("/", authenticate, requireRole({ collection: 3, task: 0 }), getTeams);


module.exports = router;
