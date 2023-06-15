const express = require("express");
const router = express.Router();
const {authenticate, requireRole} = require('../helpers/roleValidator');
const {getTeams, getTeamWithId, userInTeam, addTeam} = require('../controller/TeamController');


router.post('/', authenticate, requireRole({collection: 3, task: 1}), addTeam);
router.get('/users/:id', authenticate, requireRole({collection: 3, task: 0}), userInTeam);
router.get('/:id', authenticate, requireRole({collection: 3, task: 0}), getTeamWithId);
router.get("/", authenticate, requireRole({collection: 3, task: 0}), getTeams);


module.exports = router;
