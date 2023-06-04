const express = require("express");
const { createTask, getTaskById, deleteTask, getTasks } = require("../controller/TaskController");
const router = express.Router();
const { authenticate, requireRole } = require('../helpers/roleValidator');




router.post("/add", authenticate, requireRole({ collection: 1, task: 1 }), createTask);
router.get("/:idt", authenticate, requireRole({ collection: 1, task: 0 }), getTaskById);
router.delete("/delete/:idt", authenticate, requireRole({ collection: 1, task: 3 }), deleteTask);
//router.patch("/update/:id", authenticate, ProjectController.updateProject);
router.get("/", authenticate, requireRole({ collection: 1, task: 0 }), getTasks);

module.exports = router;
