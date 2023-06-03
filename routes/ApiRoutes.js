const express = require("express");
const router = express.Router();
const projectRoutes = require("./projects");
//const userRoutes = require("./user");
const taskRoutes = require("./tasks");
router.use("/projects", projectRoutes);
//router.use("/user", userRoutes);
router.use("/tasks", taskRoutes);
module.exports = router;
// dm/api/projects/tasks/updtea
