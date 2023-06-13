const express = require("express");
const router = express.Router();
const { getUser, getUsers } = require('../controller/UserController');
const { authenticate, requireRole } = require("../helpers/roleValidator");

router.get('/:id', authenticate, requireRole({ collection: 2, task: 0 }), getUser);
router.get('/', authenticate, requireRole({ collection: 2, task: 0 }), getUsers);
module.exports = router;
