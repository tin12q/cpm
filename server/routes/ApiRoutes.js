const express = require("express");
const router = express.Router();
const projectRoutes = require("./projects");
const Auth = require("./AuthRoutes");
const teamRoutes = require("./team");
//const userRoutes = require("./user");
const taskRoutes = require("./tasks");


router.use("/projects", projectRoutes);
//router.use("/user", userRoutes);
router.use("/tasks", taskRoutes);
router.use("/auth", Auth);
router.use('/teams', teamRoutes);
module.exports = router;
// dm/api/projects/tasks/updtea
