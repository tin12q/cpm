/**
 * Assignment Routes
 * Routes cho phân công task tự động
 */

const express = require("express");
const router = express.Router();
const {
	previewAssignment,
	applyAssignment,
	overrideAssignment,
	reassignProject,
	getDefaultConfig,
} = require("../controller/AssignmentController");

// GET: Lấy default config
router.get("/default-config", getDefaultConfig);

// POST: Preview assignment (không apply vào DB)
router.post("/preview", previewAssignment);

// POST: Apply assignment vào DB
router.post("/apply", applyAssignment);

// PUT: Override assignment thủ công
router.put("/:taskId/override", overrideAssignment);

// POST: Reassign tất cả tasks của project
router.post("/reassign-project/:projectId", reassignProject);

module.exports = router;
