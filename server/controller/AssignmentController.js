/**
 * Task Assignment Controller
 * Xử lý các API requests cho phân công task tự động
 */

const TaskAssignmentService = require("../services/TaskAssignmentService");

/**
 * API: Phân công tasks tự động (preview mode - không apply vào DB)
 * POST /api/assignments/preview
 * Body: {
 *   task_ids: [string],
 *   user_ids?: [string],
 *   config?: {
 *     W_deadline?: number,
 *     W_priority?: number,
 *     W_speed?: number,
 *     W_skill?: number,
 *     W_workload?: number
 *   }
 * }
 */
const previewAssignment = async (req, res) => {
	try {
		const { task_ids, user_ids, config } = req.body;

		if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
			return res.status(400).json({
				error: "task_ids is required and must be a non-empty array",
			});
		}

		const result = await TaskAssignmentService.assignTasks(
			task_ids,
			user_ids,
			config
		);

		res.json(result);
	} catch (error) {
		console.error("Error in previewAssignment:", error);
		res.status(500).json({ error: error.message });
	}
};

/**
 * API: Phân công và apply vào database
 * POST /api/assignments/apply
 * Body: {
 *   task_ids: [string],
 *   user_ids?: [string],
 *   config?: {...}
 * }
 */
const applyAssignment = async (req, res) => {
	try {
		const { task_ids, user_ids, config } = req.body;

		if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
			return res.status(400).json({
				error: "task_ids is required and must be a non-empty array",
			});
		}

		const result = await TaskAssignmentService.assignAndApply(
			task_ids,
			user_ids,
			config
		);

		res.json(result);
	} catch (error) {
		console.error("Error in applyAssignment:", error);
		res.status(500).json({ error: error.message });
	}
};

/**
 * API: Override assignment - PM thay đổi phân công thủ công
 * PUT /api/assignments/:taskId/override
 * Body: {
 *   user_ids: [string]
 * }
 */
const overrideAssignment = async (req, res) => {
	try {
		const { taskId } = req.params;
		const { user_ids } = req.body;

		if (!user_ids || !Array.isArray(user_ids)) {
			return res.status(400).json({
				error: "user_ids is required and must be an array",
			});
		}

		const result = await TaskAssignmentService.overrideAssignment(
			taskId,
			user_ids
		);

		res.json(result);
	} catch (error) {
		console.error("Error in overrideAssignment:", error);
		res.status(500).json({ error: error.message });
	}
};

/**
 * API: Tái phân công tất cả tasks của một project
 * POST /api/assignments/reassign-project/:projectId
 * Body: {
 *   config?: {...}
 * }
 */
const reassignProject = async (req, res) => {
	try {
		const { projectId } = req.params;
		const { config } = req.body;

		const result = await TaskAssignmentService.reassignByProject(
			projectId,
			config
		);

		res.json(result);
	} catch (error) {
		console.error("Error in reassignProject:", error);
		res.status(500).json({ error: error.message });
	}
};

/**
 * API: Lấy thông tin config weights mặc định
 * GET /api/assignments/default-config
 */
const getDefaultConfig = async (req, res) => {
	try {
		const defaultConfig = {
			W_deadline: 0.5,
			W_priority: 0.2,
			W_speed: 0.2,
			W_skill: 0.1,
			W_workload: 0.05,
			MAX_PRIORITY: 5,
			MAX_TASK_COUNT: 10,
			description: {
				W_deadline: "Trọng số cho deadline (càng gần deadline càng ưu tiên)",
				W_priority: "Trọng số cho priority của task",
				W_speed: "Trọng số cho productivity score của user",
				W_skill: "Trọng số cho skill matching",
				W_workload: "Penalty cho số task hiện tại của user",
			},
		};

		res.json(defaultConfig);
	} catch (error) {
		console.error("Error in getDefaultConfig:", error);
		res.status(500).json({ error: error.message });
	}
};

module.exports = {
	previewAssignment,
	applyAssignment,
	overrideAssignment,
	reassignProject,
	getDefaultConfig,
};
