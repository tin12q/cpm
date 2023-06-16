const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require('../helpers/roleValidator');
const {
    addProject,
    deleteProject,
    getProjectById,
    getProjects,
    updateProject,
    findProject
} = require("../controller/ProjectController");


router.get('/search', authenticate, requireRole({ collection: 0, task: 0 }), findProject);
router.delete("/:id", authenticate, requireRole({ collection: 0, task: 3 }), deleteProject);
router.get("/:id", authenticate, requireRole({ collection: 0, task: 0 }), getProjectById);
router.put("/:id", authenticate, requireRole({ collection: 0, task: 2 }), updateProject);
router.post("/", authenticate, requireRole({ collection: 0, task: 1 }), addProject);
router.get("/", authenticate, requireRole({ collection: 0, task: 0 }), getProjects);

module.exports = router;
