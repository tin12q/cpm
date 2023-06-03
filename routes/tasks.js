const express = require("express");
const { createTask, getTaskById, deleteTask, getTasks } = require("../controller/TaskController");
const router = express.Router();



router.post("/add", createTask);
router.get("/:idt", getTaskById);
router.delete("/delete/:idt", deleteTask);
//router.patch("/update/:id", ProjectController.updateProject);
router.get("/", getTasks);

module.exports = router;
