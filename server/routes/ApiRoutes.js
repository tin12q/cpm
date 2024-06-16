const express = require("express");
const router = express.Router();
const projectRoutes = require("./projects");
const Auth = require("./AuthRoutes");
const teamRoutes = require("./team");
const userRoutes = require("./user");
const taskRoutes = require("./tasks");
const fileRoutes = require("./file");

router.use("/projects", projectRoutes);
router.use("/users", userRoutes);
router.use("/tasks", taskRoutes);
router.use("/auth", Auth);
router.use('/teams', teamRoutes);
router.use('/file', fileRoutes);
module.exports = router;
// dm/api/projects/tasks/updtea
