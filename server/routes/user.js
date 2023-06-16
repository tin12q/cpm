const express = require("express");
const router = express.Router();
const { getUser, getUsers, addUser, deleteUser, updateUser, findByName } = require('../controller/UserController');
const { authenticate, requireRole } = require("../helpers/roleValidator");

router.get('/search', authenticate, requireRole({ collection: 2, task: 0 }), findByName);
router.delete('/:id', authenticate, requireRole({ collection: 2, task: 3 }), deleteUser);
router.put('/:id', authenticate, requireRole({ collection: 2, task: 1 }), updateUser);
router.get('/:id', authenticate, requireRole({ collection: 2, task: 0 }), getUser);


router.post('/', authenticate, requireRole({ collection: 2, task: 2 }), addUser);

router.get('/', authenticate, requireRole({ collection: 2, task: 0 }), getUsers);
module.exports = router;
