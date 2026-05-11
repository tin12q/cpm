const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../helpers/roleValidator");
const {
  listStageTemplates,
  getStageTemplateById,
  createStageTemplate,
  updateStageTemplate,
  deleteStageTemplate,
} = require("../controller/StageTemplateController");

router.get("/", authenticate, requireRole({ collection: 0, task: 0 }), listStageTemplates);
router.get("/:id", authenticate, requireRole({ collection: 0, task: 0 }), getStageTemplateById);
router.post("/", authenticate, requireRole({ collection: 0, task: 1 }), createStageTemplate);
router.put("/:id", authenticate, requireRole({ collection: 0, task: 2 }), updateStageTemplate);
router.delete("/:id", authenticate, requireRole({ collection: 0, task: 3 }), deleteStageTemplate);

module.exports = router;
