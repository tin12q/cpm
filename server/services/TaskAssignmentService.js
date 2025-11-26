/**
 * Task Assignment Service
 * Sử dụng Min-Cost Max-Flow để phân công task tối ưu
 */

const Task = require("../models/task.model");
const User = require("../models/user.model");
const {
	calculateAllCosts,
	prepareGraphData,
} = require("../helpers/assignmentHelper");
const { runMinCostMaxFlow } = require("../helpers/minCostMaxFlow");

class TaskAssignmentService {
	/**
	 * Phân công tasks tự động cho users
	 * @param {Array<string>} taskIds - Danh sách task IDs cần phân công
	 * @param {Array<string>} userIds - Danh sách user IDs có thể được phân công (optional)
	 * @param {Object} config - Configuration cho weights
	 * @returns {Promise<Object>} - Kết quả phân công
	 */
	static async assignTasks(taskIds, userIds = null, config = {}) {
		try {
			// Lấy danh sách tasks
			const tasks = await Task.find({
				_id: { $in: taskIds },
			});

			if (tasks.length === 0) {
				throw new Error("No tasks found");
			}

			// Lấy danh sách users
			let users;
			if (userIds && userIds.length > 0) {
				users = await User.find({
					_id: { $in: userIds },
				});
			} else {
				// Lấy tất cả users không phải admin
				users = await User.find({
					role: { $ne: "admin" },
				});
			}

			if (users.length === 0) {
				throw new Error("No users available for assignment");
			}

			// Tính cost matrix
			const costMatrix = calculateAllCosts(tasks, users, config);

			// Chuẩn bị graph data
			const graphData = prepareGraphData(tasks, users, costMatrix);

			// Chạy Min-Cost Max-Flow
			const result = runMinCostMaxFlow(graphData);

			// Format kết quả
			const formattedAssignments = await this.formatAssignments(
				result.assignments,
				tasks,
				users
			);

			return {
				success: true,
				maxFlow: result.maxFlow,
				minCost: result.minCost,
				assignments: formattedAssignments,
				summary: this.generateSummary(formattedAssignments),
			};
		} catch (error) {
			console.error("Error in assignTasks:", error);
			throw error;
		}
	}

	/**
	 * Format assignments cho output
	 * @param {Object} assignments - Raw assignments từ MCMF
	 * @param {Array} tasks - Danh sách tasks
	 * @param {Array} users - Danh sách users
	 * @returns {Promise<Array>} - Formatted assignments
	 */
	static async formatAssignments(assignments, tasks, users) {
		const formatted = [];

		for (const [taskId, userIds] of Object.entries(assignments)) {
			const task = tasks.find((t) => t._id.toString() === taskId);
			const assignedUsers = users.filter((u) =>
				userIds.includes(u._id.toString())
			);

			formatted.push({
				task: {
					id: task._id,
					title: task.title,
					priority: task.priority,
					total_hours: task.total_hours,
					due_date: task.due_date,
					skills_required: task.skills_required,
				},
				assigned_users: assignedUsers.map((u) => ({
					id: u._id,
					name: u.name,
					email: u.email,
					skills: u.skills,
					productivity_score: u.productivity_score,
				})),
				number_of_people: assignedUsers.length,
			});
		}

		return formatted;
	}

	/**
	 * Tạo summary cho kết quả phân công
	 * @param {Array} assignments - Formatted assignments
	 * @returns {Object} - Summary
	 */
	static generateSummary(assignments) {
		const totalTasks = assignments.length;
		const totalUsers = new Set(
			assignments.flatMap((a) => a.assigned_users.map((u) => u.id.toString()))
		).size;

		const tasksByPriority = {};
		assignments.forEach((a) => {
			const priority = a.task.priority || 3;
			tasksByPriority[priority] = (tasksByPriority[priority] || 0) + 1;
		});

		return {
			total_tasks_assigned: totalTasks,
			total_users_involved: totalUsers,
			tasks_by_priority: tasksByPriority,
			average_users_per_task:
				totalTasks > 0
					? (
							assignments.reduce((sum, a) => sum + a.number_of_people, 0) /
							totalTasks
					  ).toFixed(2)
					: 0,
		};
	}

	/**
	 * Apply assignments vào database
	 * @param {Array} assignments - Formatted assignments
	 * @returns {Promise<Object>} - Result
	 */
	static async applyAssignments(assignments) {
		try {
			const updates = [];

			for (const assignment of assignments) {
				const userIds = assignment.assigned_users.map((u) => u.id);

				// Update task
				const updateTask = Task.findByIdAndUpdate(
					assignment.task.id,
					{
						assigned_to: userIds,
					},
					{ new: true }
				);
				updates.push(updateTask);

				// Update current_task_count cho users
				for (const user of assignment.assigned_users) {
					const updateUser = User.findByIdAndUpdate(user.id, {
						$inc: { current_task_count: 1 },
					});
					updates.push(updateUser);
				}
			}

			await Promise.all(updates);

			return {
				success: true,
				message: "Assignments applied successfully",
				tasks_updated: assignments.length,
			};
		} catch (error) {
			console.error("Error in applyAssignments:", error);
			throw error;
		}
	}

	/**
	 * Phân công và apply vào database trong 1 bước
	 * @param {Array<string>} taskIds - Task IDs
	 * @param {Array<string>} userIds - User IDs (optional)
	 * @param {Object} config - Configuration
	 * @returns {Promise<Object>} - Result
	 */
	static async assignAndApply(taskIds, userIds = null, config = {}) {
		try {
			// Phân công tasks
			const assignmentResult = await this.assignTasks(taskIds, userIds, config);

			// Apply vào database
			await this.applyAssignments(assignmentResult.assignments);

			return {
				success: true,
				...assignmentResult,
				applied: true,
			};
		} catch (error) {
			console.error("Error in assignAndApply:", error);
			throw error;
		}
	}

	/**
	 * Override assignment - PM có thể thay đổi phân công
	 * @param {string} taskId - Task ID
	 * @param {Array<string>} userIds - User IDs mới
	 * @returns {Promise<Object>} - Result
	 */
	static async overrideAssignment(taskId, userIds) {
		try {
			// Lấy task cũ
			const oldTask = await Task.findById(taskId);
			if (!oldTask) {
				throw new Error("Task not found");
			}

			// Giảm current_task_count cho users cũ
			if (oldTask.assigned_to && oldTask.assigned_to.length > 0) {
				await User.updateMany(
					{ _id: { $in: oldTask.assigned_to } },
					{ $inc: { current_task_count: -1 } }
				);
			}

			// Update task với users mới
			const updatedTask = await Task.findByIdAndUpdate(
				taskId,
				{ assigned_to: userIds },
				{ new: true }
			).populate("assigned_to");

			// Tăng current_task_count cho users mới
			if (userIds && userIds.length > 0) {
				await User.updateMany(
					{ _id: { $in: userIds } },
					{ $inc: { current_task_count: 1 } }
				);
			}

			return {
				success: true,
				message: "Assignment overridden successfully",
				task: updatedTask,
			};
		} catch (error) {
			console.error("Error in overrideAssignment:", error);
			throw error;
		}
	}

	/**
	 * Tái phân công tasks khi priority thay đổi
	 * @param {string} projectId - Project ID
	 * @param {Object} config - Configuration
	 * @returns {Promise<Object>} - Result
	 */
	static async reassignByProject(projectId, config = {}) {
		try {
			// Lấy tất cả tasks chưa hoàn thành của project
			const tasks = await Task.find({
				project: projectId,
				status: { $ne: "completed" },
			});

			if (tasks.length === 0) {
				return {
					success: true,
					message: "No tasks to reassign",
					assignments: [],
				};
			}

			const taskIds = tasks.map((t) => t._id.toString());

			// Phân công lại
			return await this.assignAndApply(taskIds, null, config);
		} catch (error) {
			console.error("Error in reassignByProject:", error);
			throw error;
		}
	}
}

module.exports = TaskAssignmentService;
