const express = require("express");
const router = express.Router();
const projectRoutes = require("./projects");
const Auth = require("./AuthRoutes");
const teamRoutes = require("./team");
const userRoutes = require("./user");
const taskRoutes = require("./tasks");
const fileRoutes = require("./file");
const assignmentRoutes = require("./assignments");
const skillRoutes = require("./skills");
const stageTemplateRoutes = require("./stageTemplates");
const contactRoutes = require("./contacts");
const chatbotRoutes = require("./chatbot");

router.use("/projects", projectRoutes);
router.use("/users", userRoutes);
router.use("/tasks", taskRoutes);
router.use("/auth", Auth);
router.use("/teams", teamRoutes);
router.use("/file", fileRoutes);
router.use("/assignments", assignmentRoutes);
router.use("/skills", skillRoutes);
router.use("/stage-templates", stageTemplateRoutes);
router.use("/contacts", contactRoutes);
router.use("/chatbot", chatbotRoutes);

module.exports = router;
