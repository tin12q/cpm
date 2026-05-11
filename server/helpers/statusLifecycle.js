const mongoose = require("mongoose");
const Project = require("../models/project.model");
const Task = require("../models/task.model");

const TERMINAL_TASK_STATUSES = ["completed", "late"];

function normalizeStatus(value) {
	const normalized = String(value || "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_");
	if (["done", "complete", "finished"].includes(normalized)) return "completed";
	if (["overdue", "delayed"].includes(normalized)) return "late";
	if (["inprogress", "pending", ""].includes(normalized)) return "in progress";
	if (normalized === "in_progress") return "in progress";
	return normalized;
}

function isCompletedTask(task) {
	return normalizeStatus(task?.status) === "completed";
}

function isLateTask(task, now = Date.now()) {
	const status = normalizeStatus(task?.status);
	if (status === "late") return true;
	if (status === "completed") return false;
	return Number(task?.due_date || 0) > 0 && Number(task.due_date) < now;
}

function deriveTaskStatus(task, now = Date.now()) {
	const status = normalizeStatus(task?.status);
	if (TERMINAL_TASK_STATUSES.includes(status)) return status;
	return isLateTask(task, now) ? "late" : "in progress";
}

function deriveProjectStatus(project, tasks = [], now = Date.now()) {
	const projectDuePassed = Number(project?.due_date || 0) > 0 && Number(project.due_date) < now;
	if (!Array.isArray(tasks) || tasks.length === 0) {
		const currentStatus = normalizeStatus(project?.status || "in progress");
		return projectDuePassed && currentStatus !== "completed" ? "late" : currentStatus;
	}

	const taskStatuses = tasks.map((task) => deriveTaskStatus(task, now));
	if (taskStatuses.every((status) => status === "completed")) return "completed";
	if (projectDuePassed) return "late";
	return "in progress";
}

function buildOverdueQuery(baseQuery = {}, now = Date.now()) {
	const clauses = [
		{ due_date: { $lt: now } },
		{ status: { $nin: ["completed", "late"] } },
	];
	if (baseQuery && Object.keys(baseQuery).length > 0) {
		clauses.unshift(baseQuery);
	}
	return { $and: clauses };
}

async function syncProjectStatus(projectId, now = Date.now()) {
	if (!projectId || !mongoose.Types.ObjectId.isValid(String(projectId))) {
		return null;
	}

	const project = await Project.findById(projectId);
	if (!project) return null;

	const tasks = await Task.find({ project: project._id }).select("status due_date").lean();
	const nextStatus = deriveProjectStatus(project, tasks, now);
	if (normalizeStatus(project.status) !== nextStatus) {
		project.status = nextStatus;
		await project.save();
	}
	return nextStatus;
}

async function syncProjectStatuses(projectIds = [], now = Date.now()) {
	const uniqueIds = [
		...new Set(
			(projectIds || [])
				.map((id) => String(id || ""))
				.filter((id) => mongoose.Types.ObjectId.isValid(id))
		),
	];
	await Promise.all(uniqueIds.map((projectId) => syncProjectStatus(projectId, now)));
}

async function syncOverdueTasks(baseQuery = {}, now = Date.now()) {
	const query = buildOverdueQuery(baseQuery, now);
	const projectIds = await Task.distinct("project", query);
	if (projectIds.length > 0) {
		await Task.updateMany(query, { $set: { status: "late" } });
		await syncProjectStatuses(projectIds, now);
	}
	return projectIds;
}

async function syncTaskAndProject(taskId, now = Date.now()) {
	const task = await Task.findById(taskId);
	if (!task) return null;
	const nextStatus = deriveTaskStatus(task, now);
	if (normalizeStatus(task.status) !== nextStatus) {
		task.status = nextStatus;
		await task.save();
	}
	await syncProjectStatus(task.project, now);
	return task;
}

module.exports = {
	deriveProjectStatus,
	deriveTaskStatus,
	isCompletedTask,
	isLateTask,
	normalizeStatus,
	syncOverdueTasks,
	syncProjectStatus,
	syncProjectStatuses,
	syncTaskAndProject,
};
