/**
 * Task Assignment Service
 * Two-stage assignment: MCMF for availability + Embedding for best match
 */

const Task = require("../models/task.model");
const User = require("../models/user.model");
const Project = require("../models/project.model");
const Team = require("../models/team.model");
const {
	calculateAllCosts,
	prepareGraphData,
} = require("../helpers/assignmentHelper");
const { runMinCostMaxFlow } = require("../helpers/minCostMaxFlow");
const {
	calculateAdvancedHybridSkillMatch,
	initializeEmbeddingSystem,
} = require("../helpers/embeddingHelper");

class TaskAssignmentService {
	static normalizeSkillList(skills) {
		if (!Array.isArray(skills)) return [];
		return skills
			.map((skill) => {
				if (typeof skill === "string") return skill.trim();
				if (skill && typeof skill === "object") return String(skill.name || skill.label || skill.value || "").trim();
				return "";
			})
			.filter(Boolean);
	}

	static normalizeTaskPayload(taskLike = {}) {
		return {
			...taskLike,
			required_skills: this.normalizeSkillList(taskLike.required_skills || taskLike.skills_required),
			skills_required: this.normalizeSkillList(taskLike.required_skills || taskLike.skills_required),
			title: taskLike.title || "Untitled task",
			description: taskLike.description || "",
			priority: Number(taskLike.priority || 3),
			difficulty: Number(taskLike.difficulty || 2),
			due_date: Number(taskLike.due_date || Date.now() + 86400000),
			can_parallelize: taskLike.can_parallelize !== false,
		};
	}

	static getMaxBatchTasksPerUser(tasks, users, config = {}) {
		const configuredLimit = Number(config.maxBatchTasksPerUser);
		if (Number.isFinite(configuredLimit) && configuredLimit > 0) {
			return Math.max(1, Math.floor(configuredLimit));
		}

		const taskCount = Array.isArray(tasks) ? tasks.length : 0;
		const userCount = Array.isArray(users) ? users.length : 0;
		if (taskCount === 0 || userCount === 0) return 1;

		return Math.max(2, Math.ceil(taskCount / userCount) + 1);
	}

	static async getCandidateUsers(userIds = null, projectId = null) {
		if (Array.isArray(userIds) && userIds.length > 0) {
			return User.find({ _id: { $in: userIds } });
		}

		if (projectId) {
			const project = await Project.findById(projectId).select("team teams");
			if (project) {
				const teamIds = Array.isArray(project.teams) && project.teams.length > 0
					? project.teams
					: project.team
						? [project.team]
						: [];
				if (teamIds.length > 0) {
					const teams = await Team.find({ _id: { $in: teamIds } }).select("members");
					const memberIds = [...new Set(
						teams.flatMap((team) => (team.members || []).map((memberId) => memberId.toString()))
					)];
					if (memberIds.length > 0) {
						return User.find({
							_id: { $in: memberIds },
							role: { $ne: "admin" },
						});
					}
				}
			}
		}

		return User.find({ role: { $ne: "admin" } });
	}

	/**
	 * Two-stage assignment:
	 * Stage 1: Use MCMF to find available employees (based on workload/capacity)
	 * Stage 2: Use embedding + TF-IDF to pick best match from candidates
	 * 
	 * @param {Array<string>} taskIds - Task IDs to assign
	 * @param {Array<string>} userIds - Candidate user IDs (optional)
	 * @param {Object} config - Configuration
	 * @returns {Promise<Object>} - Assignment result
	 */
	static async assignTasksHybrid(taskIds, userIds = null, config = {}) {
		try {
			// Get tasks
			const tasks = await Task.find({ _id: { $in: taskIds } });
			if (tasks.length === 0) {
				throw new Error("No tasks found");
			}

			const projectIds = [
				...new Set(
					tasks
						.map((task) => task.project)
						.filter(Boolean)
						.map((projectId) => projectId.toString())
				),
			];

			const users = await this.getCandidateUsers(
				userIds,
				projectIds.length === 1 ? projectIds[0] : null
			);

			if (users.length === 0) {
				throw new Error("No users available for assignment");
			}

			// Initialize embedding system with user skills for TF-IDF
			await initializeEmbeddingSystem(users);

			// Stage 1 (graph-based): run MCMF once for the full task batch
			const graphAvailability = await this.findAvailableCandidatesByGraph(
				tasks,
				users,
				config
			);

			const assignments = [];
			const batchAssignmentCounts = new Map();
			const maxBatchTasksPerUser = this.getMaxBatchTasksPerUser(
				tasks,
				users,
				config
			);

			for (const task of tasks) {
				// Stage 1: Use graph-based MCMF shortlist for each task
				const candidates =
					graphAvailability?.taskCandidates?.[task._id.toString()]?.length > 0
						? graphAvailability.taskCandidates[task._id.toString()]
						: await this.findAvailableCandidates(task, users, config);

				if (candidates.length === 0) {
					console.warn(`No available candidates for task: ${task.title}`);
					continue;
				}

				// Stage 2: Use embedding to find best match from candidates
				const bestMatches = await this.findBestMatchByEmbedding(
					task,
					candidates,
					config,
					{ batchAssignmentCounts, maxBatchTasksPerUser }
				);

				for (const match of bestMatches) {
					const userId = match.user._id.toString();
					batchAssignmentCounts.set(
						userId,
						(batchAssignmentCounts.get(userId) || 0) + 1
					);
				}

				assignments.push({
					task: {
						id: task._id,
						title: task.title,
						priority: task.priority,
						difficulty: task.difficulty,
						due_date: task.due_date,
						can_parallelize: task.can_parallelize,
					},
					assigned_users: bestMatches.map((u) => ({
						id: u.user._id,
						name: u.user.name,
						email: u.user.email,
						productivity_score: u.user.productivity_score,
						skill_score: u.skillScore,
						mcmf_score: u.mcmfScore,
						combined_score: u.combinedScore,
						adjusted_score: u.adjustedScore,
						batch_load: u.batchLoad,
					})),
					number_of_people: bestMatches.length,
				});
			}

			return {
				success: true,
				method: "hybrid_mcmf_embedding_graph",
				stage1: {
					type: "graph_mcmf_shortlist",
					max_flow: graphAvailability?.maxFlow || 0,
					min_cost: graphAvailability?.minCost || 0,
					max_batch_tasks_per_user: maxBatchTasksPerUser,
				},
				assignments,
				summary: this.generateSummary(assignments),
			};
		} catch (error) {
			console.error("Error in assignTasksHybrid:", error);
			throw error;
		}
	}

	/**
	 * Stage 1 (graph-based): Build MCMF graph across all tasks/users once,
	 * then derive shortlist candidates per task from graph assignment + low-cost buffer.
	 */
	static async findAvailableCandidatesByGraph(tasks, users, config = {}) {
		const userMap = new Map(users.map((user) => [String(user._id), user]));
		const costMatrix = calculateAllCosts(tasks, users, config);
		const graphData = prepareGraphData(tasks, users, costMatrix);
		const graphResult = runMinCostMaxFlow(graphData);

		const candidateMultiplier = Math.max(
			1,
			Number(config.graphCandidateMultiplier || 2)
		);
		const taskCandidates = {};

		for (const task of tasks) {
			const taskId = String(task._id);
			const graphUserIds = graphResult.assignments[taskId] || [];
			const graphCandidates = graphUserIds
				.map((userId) => {
					const user = userMap.get(String(userId));
					if (!user) return null;
					return {
						user,
						mcmfCost: costMatrix?.[taskId]?.[String(userId)] ?? 1,
					};
				})
				.filter(Boolean);

			// Add low-cost alternatives so stage 2 embedding can still rank among choices.
			const targetShortlistSize = task.can_parallelize
				? Math.max(
						graphCandidates.length,
						(config.maxParallelAssignees || 2) * candidateMultiplier
				  )
				: Math.max(graphCandidates.length, candidateMultiplier);

			const sortedByCost = users
				.map((user) => ({
					user,
					mcmfCost: costMatrix?.[taskId]?.[String(user._id)] ?? 1,
				}))
				.sort((a, b) => a.mcmfCost - b.mcmfCost);

			const merged = [];
			const seen = new Set();

			for (const candidate of graphCandidates) {
				const key = String(candidate.user._id);
				if (seen.has(key)) continue;
				seen.add(key);
				merged.push(candidate);
			}

			for (const candidate of sortedByCost) {
				if (merged.length >= targetShortlistSize) break;
				const key = String(candidate.user._id);
				if (seen.has(key)) continue;
				seen.add(key);
				merged.push(candidate);
			}

			taskCandidates[taskId] = merged;
		}

		return {
			taskCandidates,
			maxFlow: graphResult.maxFlow,
			minCost: graphResult.minCost,
		};
	}

	/**
	 * Stage 1: Find available candidates using MCMF cost calculation
	 * Returns users sorted by availability (lower cost = more available)
	 */
	static async findAvailableCandidates(task, users, config = {}) {
		const { calculateAssignmentCost } = require("../helpers/assignmentHelper");

		// Calculate MCMF cost for each user
		const candidatesWithCost = users.map((user) => {
			const cost = calculateAssignmentCost(task, user, config);
			return {
				user,
				mcmfCost: cost,
			};
		});

		// Sort by cost (lower = better/more available)
		candidatesWithCost.sort((a, b) => a.mcmfCost - b.mcmfCost);

		// Filter out users with too high workload (cost > threshold)
		const maxCostThreshold = config.maxCostThreshold || 0.8;
		const filtered = candidatesWithCost.filter((c) => c.mcmfCost <= maxCostThreshold);

		// If all filtered out, take top 50% anyway
		if (filtered.length === 0 && candidatesWithCost.length > 0) {
			const takeCount = Math.max(1, Math.ceil(candidatesWithCost.length / 2));
			return candidatesWithCost.slice(0, takeCount);
		}

		return filtered;
	}

	/**
	 * Stage 2: Find best match from candidates using embedding + TF-IDF
	 * Uses dot product similarity between task requirements and user skills
	 */
	static async findBestMatchByEmbedding(task, candidates, config = {}, batchContext = {}) {
		const taskSkills = task.required_skills || task.skills_required || [];
		const taskTitle = task.title || "";
		const taskDescription = task.description || "";
		const batchAssignmentCounts = batchContext.batchAssignmentCounts || new Map();
		const maxBatchTasksPerUser = Number(
			batchContext.maxBatchTasksPerUser || config.maxBatchTasksPerUser
		);
		const hasBatchLimit =
			Number.isFinite(maxBatchTasksPerUser) && maxBatchTasksPerUser > 0;
		const W_batch_workload = Number(config.W_batch_workload ?? 0.35);

		// Calculate skill match score for each candidate
		const scoredCandidates = await Promise.all(
			candidates.map(async (candidate) => {
				const userSkills = candidate.user.skills || [];

				// Use advanced hybrid matching (exact + embedding + TF-IDF)
				const matchResult = await calculateAdvancedHybridSkillMatch(
					taskSkills,
					userSkills,
					{
						taskTitle,
						taskDescription,
					}
				);

				const skillScore = typeof matchResult === "object" ? matchResult.score : matchResult;

				// Normalize MCMF cost to 0-1 score (lower cost = higher score)
				const mcmfScore = 1 - Math.min(candidate.mcmfCost, 1);

				// Combined score: weighted average
				const W_skill = config.W_skill ?? 0.6;
				const W_mcmf = config.W_mcmf ?? 0.4;
				const combinedScore = W_skill * skillScore + W_mcmf * mcmfScore;
				const userId = candidate.user._id.toString();
				const batchLoad = batchAssignmentCounts.get(userId) || 0;
				const batchLoadPenalty = hasBatchLimit
					? Math.min(1, batchLoad / maxBatchTasksPerUser)
					: 0;
				const adjustedScore =
					combinedScore - W_batch_workload * batchLoadPenalty;

				return {
					user: candidate.user,
					skillScore,
					mcmfScore,
					combinedScore,
					adjustedScore,
					batchLoad,
					batchLoadPenalty,
					breakdown: matchResult.breakdown || null,
				};
			})
		);

		// Sort by adjusted score (higher = better) so repeated picks in the same
		// preview/apply batch are penalized before persisting anything.
		scoredCandidates.sort((a, b) => b.adjustedScore - a.adjustedScore);

		// Determine how many to assign
		const maxAssignees = task.can_parallelize ? (config.maxParallelAssignees || 2) : 1;
		const minScoreThreshold = config.minScoreThreshold || 0.1;
		const selectionPool = scoredCandidates.filter((candidate) => {
			if (!hasBatchLimit) return true;
			const userId = candidate.user._id.toString();
			return (batchAssignmentCounts.get(userId) || 0) < maxBatchTasksPerUser;
		});
		const candidatesToSelect =
			selectionPool.length > 0 ? selectionPool : scoredCandidates;

		// Take top candidates that meet threshold
		const selected = candidatesToSelect
			.filter((c) => c.adjustedScore >= minScoreThreshold)
			.slice(0, maxAssignees);

		// If none meet threshold, take at least one
		if (selected.length === 0 && candidatesToSelect.length > 0) {
			selected.push(candidatesToSelect[0]);
		}

		return selected;
	}

	/**
	 * Original MCMF-only assignment (kept for backwards compatibility)
	 */
	static async assignTasks(taskIds, userIds = null, config = {}) {
		try {
			const tasks = await Task.find({ _id: { $in: taskIds } });
			if (tasks.length === 0) {
				throw new Error("No tasks found");
			}

			let users;
			if (userIds && userIds.length > 0) {
				users = await User.find({ _id: { $in: userIds } });
			} else {
				users = await User.find({ role: { $ne: "admin" } });
			}

			if (users.length === 0) {
				throw new Error("No users available for assignment");
			}

			const costMatrix = calculateAllCosts(tasks, users, config);
			const graphData = prepareGraphData(tasks, users, costMatrix);
			const result = runMinCostMaxFlow(graphData);

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

	static async previewDraftAssignment(taskInput, userIds = null, config = {}) {
		try {
			const task = this.normalizeTaskPayload(taskInput);
			const draftTask = {
				...task,
				_id: task._id || "draft-task",
			};
			const users = await this.getCandidateUsers(userIds, task.project || null);

			if (!users || users.length === 0) {
				throw new Error("No users available for assignment");
			}

			await initializeEmbeddingSystem(users);
			const graphAvailability = await this.findAvailableCandidatesByGraph(
				[draftTask],
				users,
				config
			);
			const candidates =
				graphAvailability?.taskCandidates?.[String(draftTask._id)] ||
				(await this.findAvailableCandidates(task, users, config));
			const bestMatches = await this.findBestMatchByEmbedding(task, candidates, config);
			const assignment = {
				task: {
					id: null,
					title: task.title,
					priority: task.priority,
					difficulty: task.difficulty,
					due_date: task.due_date,
					can_parallelize: task.can_parallelize,
					required_skills: task.required_skills,
				},
				assigned_users: bestMatches.map((u) => ({
					id: u.user._id,
					name: u.user.name,
					email: u.user.email,
					productivity_score: u.user.productivity_score,
					skill_score: u.skillScore,
					mcmf_score: u.mcmfScore,
					combined_score: u.combinedScore,
					adjusted_score: u.adjustedScore,
					batch_load: u.batchLoad,
				})),
				number_of_people: bestMatches.length,
			};

			return {
				success: true,
				preview: true,
				method: "hybrid_mcmf_embedding_graph",
				assignments: [assignment],
				summary: this.generateSummary([assignment]),
			};
		} catch (error) {
			console.error("Error in previewDraftAssignment:", error);
			throw error;
		}
	}

	/**
	 * Format assignments for output
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
					difficulty: task.difficulty,
					due_date: task.due_date,
					can_parallelize: task.can_parallelize,
				},
				assigned_users: assignedUsers.map((u) => ({
					id: u._id,
					name: u.name,
					email: u.email,
					productivity_score: u.productivity_score,
				})),
				number_of_people: assignedUsers.length,
			});
		}

		return formatted;
	}

	/**
	 * Generate summary
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
	 * Apply assignments to database
	 */
	static async applyAssignments(assignments) {
		try {
			const updates = [];

			for (const assignment of assignments) {
				const userIds = assignment.assigned_users.map((u) => u.id);

				const updateTask = Task.findByIdAndUpdate(
					assignment.task.id,
					{ assigned_to: userIds },
					{ new: true }
				);
				updates.push(updateTask);

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
	 * Hybrid assign and apply (default method now)
	 */
	static async assignAndApply(taskIds, userIds = null, config = {}) {
		try {
			// Use hybrid method (MCMF + Embedding)
			const assignmentResult = await this.assignTasksHybrid(taskIds, userIds, config);

			await this.applyAssignments(assignmentResult.assignments);

			return {
				success: true,
				...assignmentResult,
				applied: true,
				method: "hybrid_mcmf_embedding",
			};
		} catch (error) {
			console.error("Error in assignAndApply:", error);
			throw error;
		}
	}

	/**
	 * Override assignment
	 */
	static async overrideAssignment(taskId, userIds) {
		try {
			const oldTask = await Task.findById(taskId);
			if (!oldTask) {
				throw new Error("Task not found");
			}

			if (oldTask.assigned_to && oldTask.assigned_to.length > 0) {
				await User.updateMany(
					{ _id: { $in: oldTask.assigned_to } },
					{ $inc: { current_task_count: -1 } }
				);
			}

			const updatedTask = await Task.findByIdAndUpdate(
				taskId,
				{ assigned_to: userIds },
				{ new: true }
			).populate("assigned_to");

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
	 * Reassign by project
	 */
	static async reassignByProject(projectId, config = {}) {
		try {
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
			return await this.assignAndApply(taskIds, null, config);
		} catch (error) {
			console.error("Error in reassignByProject:", error);
			throw error;
		}
	}
}

module.exports = TaskAssignmentService;
