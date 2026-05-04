const express = require("express");
const router = express.Router();
const {
	listSkills,
	createSkill,
	updateSkill,
	deleteSkill,
} = require("../controller/SkillController");
const { authenticate, requireRole } = require("../helpers/roleValidator");

router.get("/", authenticate, requireRole({ collection: 2, task: 0 }), listSkills);
router.post("/", authenticate, requireRole({ collection: 2, task: 1 }), createSkill);
router.put("/:id", authenticate, requireRole({ collection: 2, task: 1 }), updateSkill);
router.delete("/:id", authenticate, requireRole({ collection: 2, task: 1 }), deleteSkill);

module.exports = router;