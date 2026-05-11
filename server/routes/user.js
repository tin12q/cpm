const express = require("express");
const router = express.Router();
const {
	getUser,
	getUsers,
	getAllUsers,
	addUser,
	deleteUser,
	updateUser,
	findByName,
	listSkills,
	addSkill,
	updateSkill,
	deleteSkill,
} = require('../controller/UserController');
const { authenticate, requireRole } = require("../helpers/roleValidator");
router.get('/getAll', authenticate, requireRole({ collection: 2, task: 0 }), getAllUsers );
router.get('/search', authenticate, requireRole({ collection: 2, task: 0 }), findByName);
router.delete('/:id', authenticate, requireRole({ collection: 2, task: 3 }), deleteUser);
router.put('/:id', authenticate, requireRole({ collection: 2, task: 1 }), updateUser);
router.get('/:id/skills', authenticate, requireRole({ collection: 2, task: 0 }), listSkills);
router.post('/:id/skills', authenticate, requireRole({ collection: 2, task: 1 }), addSkill);
router.put('/:id/skills/:skillId', authenticate, requireRole({ collection: 2, task: 1 }), updateSkill);
router.delete('/:id/skills/:skillId', authenticate, requireRole({ collection: 2, task: 1 }), deleteSkill);
router.get('/:id', authenticate, requireRole({ collection: 2, task: 0 }), getUser);


router.post('/', authenticate, requireRole({ collection: 2, task: 2 }), addUser);

router.get('/', authenticate, requireRole({ collection: 2, task: 0 }), getUsers);

module.exports = router;
