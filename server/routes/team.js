const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require('../helpers/roleValidator');
const { getTeams, getTeamWithId,userInTeam } = require('../controller/TeamController');

router.get('/users/:id', authenticate, requireRole({ collection: 3, task: 0 }), userInTeam);
router.get('/:id', authenticate, requireRole({ collection: 3, task: 0 }), getTeamWithId);
router.get("/", authenticate, requireRole({ collection: 3, task: 0 }), getTeams);


module.exports = router;
