const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticate, requireRole } = require("../helpers/roleValidator");
const {
  createTask,
  getTaskById,
  downloadTaskAttachment,
  deleteTask,
  getTasks,
  getTasksByProjectId,
  updateTask,
  completedPercentage,
  latePercentage,
  doneCheck,
  getTaskByUserId,
  completionByTeam,
  getDashboardOverview,
  findByName,
  getAllTasks,
  getTasksByNameMobile,
  getTaskNotes,
  addTaskNote,
} = require("../controller/TaskController");

const taskAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 8 * 1024 * 1024,
  },
});

router.get("/name", authenticate, requireRole({ collection: 1, task: 0 }), findByName);
router.get("/nameMobile", authenticate, requireRole({ collection: 1, task: 0 }), getTasksByNameMobile);
router.get("/getAll", authenticate, requireRole({ collection: 1, task: 0 }), getAllTasks);
router.get("/dashboard/overview", authenticate, requireRole({ collection: 1, task: 0 }), getDashboardOverview);
router.get("/team", authenticate, requireRole({ collection: 2, task: 1 }), completionByTeam);
router.get("/user", authenticate, requireRole({ collection: 1, task: 0 }), getTaskByUserId);
router.post("/done/:id", authenticate, requireRole({ collection: 1, task: 0 }), doneCheck);
router.get("/lated/:id", authenticate, requireRole({ collection: 1, task: 0 }), latePercentage);
router.get("/completed/:id", authenticate, requireRole({ collection: 1, task: 0 }), completedPercentage);
router.get("/project/:id", authenticate, requireRole({ collection: 1, task: 0 }), getTasksByProjectId);
router.get("/:id/notes", authenticate, requireRole({ collection: 1, task: 0 }), getTaskNotes);
router.post("/:id/notes", authenticate, requireRole({ collection: 1, task: 0 }), addTaskNote);
router.get("/:id/attachments/:attachmentId", authenticate, requireRole({ collection: 1, task: 0 }), downloadTaskAttachment);
router.post("/", authenticate, requireRole({ collection: 1, task: 1 }), taskAttachmentUpload.array("attachments", 10), createTask);
router.get("/:id", authenticate, requireRole({ collection: 1, task: 0 }), getTaskById);
router.delete("/:id", authenticate, requireRole({ collection: 1, task: 3 }), deleteTask);
router.put("/:id", authenticate, requireRole({ collection: 1, task: 2 }), taskAttachmentUpload.array("attachments", 10), updateTask);
router.get("/", authenticate, requireRole({ collection: 1, task: 0 }), getTasks);

module.exports = router;
