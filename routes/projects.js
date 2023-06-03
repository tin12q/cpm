const express = require("express");
const router = express.Router();

const {addProject, deleteProject, getProjectById, getProjects } = require("../controller/ProjectController");


router.post("/add", addProject);
router.delete("/delete/:idp", deleteProject);
router.get("/:idp", getProjectById);
//router.patch("/update/:id", updateProject);
router.get("/", getProjects);

module.exports = router;
