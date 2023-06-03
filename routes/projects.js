const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require('../helpers/roleValidator')
const { addProject, deleteProject, getProjectById, getProjects } = require("../controller/ProjectController");


router.post("/add", authenticate, requireRole({ collection: 0, task: 1 }), addProject);
router.delete("/delete/:idp", authenticate, requireRole({ collection: 0, task: 3 }), deleteProject);
router.get("/:idp", authenticate, requireRole({ collection: 0, task: 1 }), getProjectById);
//router.patch("/update/:id", updateProject);
router.get("/", authenticate, requireRole({ collection: 0, task: 1 }), getProjects);

module.exports = router;
