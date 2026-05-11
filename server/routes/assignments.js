/**
 * Assignment Routes
 * Routes cho phân công task tự động
 */

const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../helpers/roleValidator");
const {
	previewAssignment,
	applyAssignment,
	overrideAssignment,
	reassignProject,
	getDefaultConfig,
} = require("../controller/AssignmentController");

// GET: Lấy default config
router.get("/default-config", authenticate, requireRole({ collection: 1, task: 0 }), getDefaultConfig);

// POST: Preview assignment (không apply vào DB)
router.post("/preview", authenticate, requireRole({ collection: 1, task: 1 }), previewAssignment);

// POST: Apply assignment vào DB
router.post("/apply", authenticate, requireRole({ collection: 1, task: 2 }), applyAssignment);

// PUT: Override assignment thủ công
router.put("/:taskId/override", authenticate, requireRole({ collection: 1, task: 2 }), overrideAssignment);

// POST: Reassign tất cả tasks của project
router.post("/reassign-project/:projectId", authenticate, requireRole({ collection: 1, task: 2 }), reassignProject);

module.exports = router;
