const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require("mongoose");
const Project = require("../models/project.model");
const Task = require("../models/task.model");
const Team = require("../models/team.model");
const User = require("../models/user.model");
const TaskAssignmentService = require("../services/TaskAssignmentService");

const pendingSelections = new Map();
const PENDING_SELECTION_TTL_MS = 10 * 60 * 1000;

const API_CONTEXT = `
You are CPM Agent, an AI assistant inside a project/task management app for small projects and student teams.

Behavior:
- Prefer Vietnamese when the user writes Vietnamese.
- Be concise, practical, and action-oriented.
- Do not claim an API call was executed unless the app/backend actually executed it.
- Respect the user's role. Employees are read-only.
- For assignment flows, recommend preview before apply.

CPM API catalog:
- POST /api/auth/login
- POST /api/auth/register
- GET/POST /api/projects
- GET/PUT/DELETE /api/projects/:id
- GET /api/projects/getAll
- GET /api/projects/search
- GET/POST /api/tasks
- GET/PUT/DELETE /api/tasks/:id
- GET /api/tasks/project/:id
- GET /api/tasks/user
- GET /api/tasks/name
- GET /api/tasks/nameMobile
- GET /api/tasks/dashboard/overview
- POST /api/tasks/done/:id
- GET/POST /api/tasks/:id/notes
- GET /api/assignments/default-config
- POST /api/assignments/preview
- POST /api/assignments/apply
- PUT /api/assignments/:taskId/override
- POST /api/assignments/reassign-project/:projectId
- GET/POST /api/users
- GET/PUT/DELETE /api/users/:id
- GET/POST /api/users/:id/skills
- PUT/DELETE /api/users/:id/skills/:skillId
- GET/POST /api/skills
- PUT/DELETE /api/skills/:id
- GET/POST /api/teams
- GET /api/teams/:id
- GET /api/teams/users/:id
- GET /api/teams/name/:name
- GET/POST /api/stage-templates
- GET/PUT/DELETE /api/stage-templates/:id
- GET/POST /api/contacts
- GET/PUT/DELETE /api/contacts/:id

Assignment knowledge:
- Assignment uses hybrid MCMF + skill matching.
- MCMF/graph stage finds available candidates.
- Skill/embedding stage ranks fit.
- Deadline, priority, productivity/speed, skill match, persisted workload, and batch workload fairness affect score.
- Use /api/assignments/preview before /api/assignments/apply.

Executable backend tools in this chatbot route:
- list_projects
- list_tasks
- create_task for admin/manager when project and assignee can be resolved
- preview_assignment without applying database changes

Do not say you have already applied, deleted, overridden, reassigned, or bulk-updated anything unless a future backend tool actually does that operation.
`;

function rolePolicy(role) {
	switch (String(role || "").toLowerCase()) {
		case "admin":
			return "Current role: admin. Full guidance allowed. Executable chatbot tools are list projects, list tasks, create task, and preview assignment only.";
		case "manager":
			return "Current role: manager. Guide project/task/team operations in manager scope. Executable chatbot tools are list projects, list tasks, create task, and preview assignment only.";
		case "employee":
			return "Current role: employee. Read-only guidance only. Do not suggest direct create, update, delete, apply, override, or reassign actions.";
		default:
			return "Current role: unknown. Give safe read-only guidance.";
	}
}

function buildPrompt({ message, role }) {
	return `${API_CONTEXT}

${rolePolicy(role)}

User message:
${message}

Answer as CPM Agent.`;
}

function normalizeText(value = "") {
	return String(value || "")
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d");
}

function escapeRegex(input = "") {
	return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getGeminiModel() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		const error = new Error("GEMINI_API_KEY is not configured on the server");
		error.statusCode = 503;
		throw error;
	}

	const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
	const genAI = new GoogleGenerativeAI(apiKey);
	return {
		modelName,
		model: genAI.getGenerativeModel({
			model: modelName,
			generationConfig: {
				temperature: 0.25,
				maxOutputTokens: 900,
			},
		}),
	};
}

function extractJson(text = "") {
	const raw = String(text || "").trim();
	try {
		return JSON.parse(raw);
	} catch (_) {
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("AI did not return valid JSON");
		return JSON.parse(match[0]);
	}
}

async function classifyIntent(model, message, role) {
	const today = new Date().toISOString().slice(0, 10);
	const prompt = `
Classify the CPM user's request into one executable intent.
Current date: ${today}
Current role: ${role || "unknown"}

Return STRICT JSON only. Do not use markdown.
Schema:
{
  "action": "answer_only" | "list_projects" | "list_tasks" | "list_project_members" | "create_task" | "preview_assignment",
  "language": "vi" | "en",
  "params": {
    "project_name": string | null,
    "task_title": string | null,
    "description": string | null,
    "assignee_name": string | null,
    "due_date_iso": "YYYY-MM-DD" | null,
    "priority": number | null,
    "difficulty": number | null,
    "required_skills": string[] | null,
    "status": string | null,
    "limit": number | null
  }
Rules:
- If the user asks what the agent can do, asks about API paths, or asks conceptual questions, use "answer_only".
- If the user asks to show/view/list tasks, use "list_tasks".
- If the user asks to show/view/list projects, use "list_projects".
- If the user asks who is in a project or asks for project members, use "list_project_members".
- If the user asks to create/add a task, use "create_task".
- If the user asks to preview/auto assign/recommend assignees, use "preview_assignment".
- Do not use create_task for employees if role is employee; still classify the user intent as create_task and backend will reject.
- For Vietnamese "mai/ngày mai", convert to tomorrow based on Current date.
- Keep missing fields null. Do not invent project or assignee names.

User request:
${message}
`;
	const result = await model.generateContent(prompt);
	return extractJson(result.response.text());
}

function getEmptyParams(overrides = {}) {
	return {
		project_name: null,
		task_title: null,
		description: null,
		assignee_name: null,
		due_date_iso: null,
		priority: null,
		difficulty: null,
		required_skills: null,
		status: null,
		limit: null,
		...overrides,
	};
}

function getUserKey(user) {
	return String(user?.id || user?._id || "anonymous");
}

function setPendingSelection(user, pending) {
	pendingSelections.set(getUserKey(user), {
		...pending,
		createdAt: Date.now(),
	});
}

function clearPendingSelection(user) {
	pendingSelections.delete(getUserKey(user));
}

function getPendingSelection(user) {
	const key = getUserKey(user);
	const pending = pendingSelections.get(key);
	if (!pending) return null;
	if (Date.now() - pending.createdAt > PENDING_SELECTION_TTL_MS) {
		pendingSelections.delete(key);
		return null;
	}
	return pending;
}

function parseNumberSelection(message) {
	const match = String(message || "").trim().match(/^\d+$/);
	if (!match) return null;
	return Number(match[0]);
}

function formatNumberedChoices(items, formatter) {
	return items.map((item, index) => `${index + 1}. ${formatter(item)}`).join("\n");
}

function inferLimitFromMessage(message) {
	const match = normalizeText(message).match(/\b(\d{1,2})\b/);
	if (!match) return null;
	const limit = Number(match[1]);
	if (!Number.isFinite(limit)) return null;
	return Math.min(Math.max(limit, 1), 12);
}

function addDaysIso(days) {
	const date = new Date();
	date.setDate(date.getDate() + days);
	return date.toISOString().slice(0, 10);
}

function inferDueDateIso(text) {
	const normalized = normalizeText(text);
	if (!normalized) return null;
	if (normalized.includes("ngay mai") || normalized.includes("tomorrow")) {
		return addDaysIso(1);
	}
	if (normalized.includes("hom nay") || normalized.includes("today")) {
		return addDaysIso(0);
	}
	const isoMatch = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
	return isoMatch ? isoMatch[1] : null;
}

function parseCreateTaskIntent(message) {
	const patterns = [
		new RegExp(
			"t\\u1ea1o\\s+(?:task|c\\u00f4ng vi\\u1ec7c)\\s+(.+?)\\s+trong\\s+(?:d\\u1ef1 \\u00e1n|project)\\s+(.+?)\\s+cho\\s+(.+?)(?:\\s+(?:deadline|h\\u1ea1n|due)\\s+(.+))?$",
			"iu"
		),
		/create\s+(?:task|work item)\s+(.+?)\s+in\s+(?:project\s+)?(.+?)\s+for\s+(.+?)(?:\s+(?:deadline|due)\s+(.+))?$/iu,
	];
	for (const pattern of patterns) {
		const match = message.match(pattern);
		if (!match) continue;
		return {
			action: "create_task",
			language: "vi",
			params: getEmptyParams({
				task_title: match[1]?.trim() || null,
				description: match[1]?.trim() || null,
				project_name: match[2]?.trim() || null,
				assignee_name: match[3]?.trim() || null,
				due_date_iso: inferDueDateIso(match[4] || message),
			}),
		};
	}
	const simplePatterns = [
		new RegExp(
			"^t\\u1ea1o\\s+(?:task|c\\u00f4ng vi\\u1ec7c)\\s+(.+?)(?:\\s+(?:deadline|h\\u1ea1n|due)\\s+(.+))?$",
			"iu"
		),
		/^create\s+(?:task|work item)\s+(.+?)(?:\s+(?:deadline|due)\s+(.+))?$/iu,
	];
	for (const pattern of simplePatterns) {
		const match = message.match(pattern);
		if (!match) continue;
		return {
			action: "create_task",
			language: "vi",
			params: getEmptyParams({
				task_title: match[1]?.trim() || null,
				description: match[1]?.trim() || null,
				due_date_iso: inferDueDateIso(match[2] || message),
			}),
		};
	}
	return null;
}

function classifyIntentHeuristic(message) {
	const text = normalizeText(message);
	const limit = inferLimitFromMessage(message);
	const createIntent = parseCreateTaskIntent(message);
	if (createIntent) return createIntent;

	const asksList = /\b(liet ke|danh sach|xem|show|list|gan deadline|deadline)\b/.test(text);
	const mentionsTask = /\b(task|cong viec|viec)\b/.test(text);
	const mentionsProject = /\b(project|du an)\b/.test(text);
	const asksMembers =
		/\b(thanh vien|member|members|nhan su|nguoi trong|gom ai|bao gom ai)\b/.test(text) &&
		mentionsProject;
	const asksAssignment =
		/\b(preview|phan cong|assignment|assign|auto assign|goi y|de xuat)\b/.test(text) &&
		(mentionsTask || mentionsProject || text.includes("mcmf"));

	if (asksMembers) {
		return {
			action: "list_project_members",
			language: "vi",
			params: getEmptyParams({ limit }),
		};
	}

	if (asksAssignment) {
		return {
			action: "preview_assignment",
			language: "vi",
			params: getEmptyParams({ limit }),
		};
	}

	if (asksList && mentionsTask) {
		return {
			action: "list_tasks",
			language: "vi",
			params: getEmptyParams({ limit }),
		};
	}

	if (asksList && mentionsProject) {
		return {
			action: "list_projects",
			language: "vi",
			params: getEmptyParams({ limit }),
		};
	}

	return null;
}

function getStaticAnswer(message) {
	const text = normalizeText(message);
	const asksCapability =
		/\b(lam duoc gi|lam gi duoc|co the lam gi|giup duoc gi|chuc nang|kha nang|nang luc|capability|what can)\b/.test(text) ||
		(text.includes("lam duoc") && text.length <= 80);

	if (asksCapability) {
		return [
			"Mình có thể hỗ trợ bạn quản lý công việc trong nhóm:",
			"1. Xem nhanh project và các task cần chú ý.",
			"2. Tìm task theo deadline, trạng thái hoặc theo project.",
			"3. Tạo task mới khi bạn nói rõ task thuộc project nào và giao cho ai.",
			"4. Gợi ý người phù hợp để nhận task trước khi bạn áp dụng phân công.",
			"",
			"Bạn có thể nhắn kiểu: “Liệt kê 3 task gần deadline nhất” hoặc “Preview phân công cho dự án ...”.",
		].join("\n");
	}

	if (/\b(api|endpoint|path|route)\b/.test(text)) {
		return [
			"Các đường dẫn chính bạn có thể kiểm tra:",
			"- Task: `GET/POST /api/tasks`, `GET /api/tasks/project/:id`, `POST /api/tasks/done/:id`.",
			"- Project: `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id`.",
			"- Assignment: `GET /api/assignments/default-config`, `POST /api/assignments/preview`, `POST /api/assignments/apply`.",
			"- User/skill/team: `/api/users`, `/api/skills`, `/api/teams`.",
		].join("\n");
	}

	return null;
}

async function getUserTeamIds(userId) {
	const teams = await Team.find({
		members: { $elemMatch: { $eq: userId } },
	}).select("_id");
	return teams.map((team) => team._id.toString());
}

function getProjectTeamIds(project) {
	if (!project) return [];
	if (Array.isArray(project.teams) && project.teams.length > 0) {
		return project.teams.map((teamId) => teamId.toString());
	}
	if (project.team) return [project.team.toString()];
	return [];
}

async function getAccessibleProjects(user) {
	if (user?.role === "admin") {
		return Project.find().sort({ due_date: 1 });
	}
	const teamIds = await getUserTeamIds(user?.id);
	if (teamIds.length === 0) return [];
	return Project.find({ teams: { $in: teamIds } }).sort({ due_date: 1 });
}

function findByName(items, name, field = "title") {
	if (!name) return null;
	const target = normalizeText(name);
	return (
		items.find((item) => normalizeText(item[field]) === target) ||
		items.find((item) => normalizeText(item[field]).includes(target))
	);
}

function inferItemFromMessage(items, message, field = "title") {
	const text = normalizeText(message);
	if (!text) return null;
	return items.find((item) => text.includes(normalizeText(item[field])));
}

async function resolveProject({ user, projectId, projectName, message }) {
	const projects = await getAccessibleProjects(user);
	if (projectId) {
		const project = projects.find((item) => item._id.toString() === String(projectId));
		return { project, projects };
	}
	if (projectName) {
		const project =
			findByName(projects, projectName, "title") ||
			inferItemFromMessage(projects, message, "title");
		return { project, projects };
	}
	const inferredProject = inferItemFromMessage(projects, message, "title");
	if (inferredProject) {
		return { project: inferredProject, projects };
	}
	if (projects.length === 1) {
		return { project: projects[0], projects };
	}
	return { project: null, projects };
}

async function resolveAssignee({ assigneeId, assigneeName, project, message }) {
	const teamIds = getProjectTeamIds(project);
	const teams = await Team.find({ _id: { $in: teamIds } }).select("members");
	const memberIds = [
		...new Set(
			teams.flatMap((team) => (team.members || []).map((member) => member.toString()))
		),
	];
	if (assigneeId) {
		return User.findOne({
			_id: { $eq: assigneeId, $in: memberIds },
		});
	}
	if (!assigneeName) {
		const members = await User.find({ _id: { $in: memberIds } }).select("name email");
		return inferItemFromMessage(members, message, "name");
	}
	const query = {
		_id: { $in: memberIds },
		$or: [
			{ name: new RegExp(escapeRegex(assigneeName), "i") },
			{ email: new RegExp(escapeRegex(assigneeName), "i") },
		],
	};
	return User.findOne(query);
}

async function getProjectMembers(project) {
	const teamIds = getProjectTeamIds(project);
	const teams = await Team.find({ _id: { $in: teamIds } }).select("members");
	const memberIds = [
		...new Set(
			teams.flatMap((team) => (team.members || []).map((member) => member.toString()))
		),
	];
	return User.find({ _id: { $in: memberIds } }).select("name email role skills current_task_count");
}

function formatDateMillis(dateIso, fallbackMillis) {
	if (!dateIso) return fallbackMillis || Date.now() + 86400000;
	const parsed = Date.parse(`${dateIso}T23:59:00+07:00`);
	return Number.isFinite(parsed) ? parsed : fallbackMillis || Date.now() + 86400000;
}

function taskStatus(task) {
	return String(task.status || "in progress");
}

async function listProjectsTool({ user, params }) {
	const limit = Math.min(Number(params?.limit) || 5, 10);
	const projects = (await getAccessibleProjects(user)).slice(0, limit);
	if (projects.length === 0) {
		return "Không tìm thấy project nào bạn có quyền xem.";
	}
	return [
		`Mình tìm thấy ${projects.length} project bạn có quyền xem:`,
		...projects.map((project) => {
			const due = project.due_date
				? new Date(project.due_date).toLocaleDateString("vi-VN")
				: "chưa có deadline";
			return `- ${project.title} (${project.status || "in progress"}, deadline: ${due})`;
		}),
	].join("\n");
}

async function listTasksTool({ user, params, message }) {
	const limit = Math.min(Number(params?.limit) || 7, 12);
	const { project, projects } = await resolveProject({
		user,
		projectId: params?.project_id,
		projectName: params?.project_name,
		message,
	});
	const projectIds = project
		? [project._id]
		: projects.map((item) => item._id);
	const query = { project: { $in: projectIds } };
	if (user?.role === "employee") {
		query.assigned_to = { $elemMatch: { $eq: new mongoose.Types.ObjectId(user.id) } };
	}
	if (params?.status) {
		query.status = new RegExp(escapeRegex(params.status), "i");
	}
	const tasks = await Task.find(query)
		.populate("assigned_to", "name email")
		.sort({ due_date: 1 })
		.limit(limit);
	if (tasks.length === 0) {
		return "Không tìm thấy task phù hợp với yêu cầu.";
	}
	return [
		`Mình tìm thấy ${tasks.length} task:`,
		...tasks.map((task) => {
			const due = task.due_date
				? new Date(task.due_date).toLocaleDateString("vi-VN")
				: "chưa có deadline";
			const assignees = (task.assigned_to || [])
				.map((user) => user.name)
				.filter(Boolean)
				.join(", ") || "chưa có người làm";
			return `- ${task.title} (${taskStatus(task)}, deadline: ${due}, người làm: ${assignees})`;
		}),
	].join("\n");
}

async function createTaskTool({ user, params, message }) {
	if (!["admin", "manager"].includes(user?.role)) {
		return "Tài khoản của bạn chỉ có quyền xem. Mình không thể tạo task bằng role hiện tại.";
	}

	if (!params?.task_title) {
		return "Bạn muốn tạo task tên gì? Hãy gửi thêm tên task.";
	}

	const { project, projects } = await resolveProject({
		user,
		projectId: params.project_id,
		projectName: params.project_name,
		message,
	});
	if (!project) {
		const choices = projects.slice(0, 5);
		if (choices.length === 0) {
			return "Mình chưa tìm thấy project phù hợp để tạo task.";
		}
		setPendingSelection(user, {
			type: "create_task_project",
			params,
			choices: choices.map((item) => ({
				id: item._id.toString(),
				label: item.title,
			})),
		});
		return [
			"Mình cần biết task này thuộc project nào. Bạn chọn số giúp mình nhé:",
			formatNumberedChoices(choices, (item) => item.title),
		].join("\n");
	}

	const assignee = await resolveAssignee({
		assigneeId: params.assignee_id,
		assigneeName: params.assignee_name,
		project,
		message,
	});
	if (!assignee) {
		const members = await getProjectMembers(project);
		if (members.length === 0) {
			return `Project "${project.title}" chưa có thành viên để giao task.`;
		}
		setPendingSelection(user, {
			type: "create_task_assignee",
			params: {
				...params,
				project_id: project._id.toString(),
			},
			choices: members.map((member) => ({
				id: member._id.toString(),
				label: member.name || member.email || member._id.toString(),
			})),
		});
		return [
			`Bạn muốn giao task này cho ai trong project "${project.title}"? Chọn số giúp mình:`,
			formatNumberedChoices(members, (member) => {
				const skills = (member.skills || []).map((skill) => skill.name).filter(Boolean).slice(0, 3).join(", ");
				const role = member.role ? `, ${member.role}` : "";
				return `${member.name || member.email}${role}${skills ? `, kỹ năng: ${skills}` : ""}`;
			}),
		].join("\n");
	}

	const skills = Array.isArray(params.required_skills)
		? params.required_skills.map((skill) => String(skill).trim()).filter(Boolean)
		: [];
	const task = new Task({
		title: params.task_title,
		description: params.description || params.task_title,
		project: project._id,
		assigned_to: [assignee._id],
		due_date: formatDateMillis(params.due_date_iso, project.due_date),
		status: "in progress",
		stage: Project.normalizeStages(project.stages)[0]?.key || "backlog",
		priority: Math.min(Math.max(Number(params.priority) || 3, 1), 5),
		difficulty: Math.min(Math.max(Number(params.difficulty) || 2, 1), 4),
		can_parallelize: true,
		required_skills: skills,
		skills_required: skills,
	});
	await task.save();

	await User.findByIdAndUpdate(assignee._id, {
		$inc: { current_task_count: 1 },
	});

	const due = new Date(task.due_date).toLocaleDateString("vi-VN");
	clearPendingSelection(user);
	return `Đã tạo task "${task.title}" trong project "${project.title}", giao cho ${assignee.name}, deadline ${due}.`;
}

async function listProjectMembersTool({ user, params, message }) {
	const { project, projects } = await resolveProject({
		user,
		projectId: params?.project_id,
		projectName: params?.project_name,
		message,
	});
	if (!project) {
		const choices = projects.slice(0, 5);
		if (choices.length === 0) {
			return "Mình chưa tìm thấy project nào bạn có quyền xem.";
		}
		setPendingSelection(user, {
			type: "list_project_members_project",
			params,
			choices: choices.map((item) => ({
				id: item._id.toString(),
				label: item.title,
			})),
		});
		return [
			"Bạn muốn xem thành viên của project nào? Chọn số giúp mình:",
			formatNumberedChoices(choices, (item) => item.title),
		].join("\n");
	}

	const members = await getProjectMembers(project);
	if (members.length === 0) {
		return `Project "${project.title}" hiện chưa có thành viên.`;
	}

	return [
		`Thành viên trong project "${project.title}" gồm:`,
		...members.map((member, index) => {
			const skills = (member.skills || []).map((skill) => skill.name).filter(Boolean).slice(0, 4).join(", ");
			const taskCount = Number.isFinite(member.current_task_count)
				? `, đang có ${member.current_task_count} task`
				: "";
			return `${index + 1}. ${member.name || member.email} (${member.role || "member"}${taskCount}${skills ? `, kỹ năng: ${skills}` : ""})`;
		}),
	].join("\n");
}

async function previewAssignmentTool({ user, params, message }) {
	if (!["admin", "manager"].includes(user?.role)) {
		return "Role hiện tại chỉ có quyền xem, không thể preview phân công tự động.";
	}

	const { project, projects } = await resolveProject({
		user,
		projectId: params?.project_id,
		projectName: params?.project_name,
		message,
	});
	const limit = Math.min(Number(params?.limit) || 3, 3);
	let tasks = [];
	if (params?.task_title) {
		const projectIds = project
			? [project._id]
			: projects.map((item) => item._id);
		tasks = await Task.find({
			project: { $in: projectIds },
			title: new RegExp(escapeRegex(params.task_title), "i"),
			status: { $ne: "completed" },
		}).limit(limit);
	} else if (project) {
		tasks = await Task.find({
			project: project._id,
			status: { $ne: "completed" },
		})
			.sort({ due_date: 1 })
			.limit(limit);
	}

	if (tasks.length === 0) {
		return "Mình chưa tìm thấy task phù hợp để preview assignment. Hãy nói rõ tên project hoặc tên task.";
	}

	const result = await TaskAssignmentService.assignTasksHybrid(
		tasks.map((task) => task._id.toString()),
		null,
		{
			maxParallelAssignees: 2,
			disableExternalEmbedding: true,
		}
	);
	const lines = result.assignments.map((assignment) => {
		const names = assignment.assigned_users.map((u) => u.name).join(", ") || "chưa có gợi ý";
		return `- ${assignment.task.title}: ${names}`;
	});
	return [
		`Preview phân công cho ${result.assignments.length} task:`,
		...lines,
		"Chưa apply vào database. Chatbot chỉ preview nhanh tối đa 3 task để tránh treo; muốn batch lớn hãy dùng màn Assignment Preview.",
	].join("\n");
}

async function handlePendingSelection({ user, message }) {
	const pending = getPendingSelection(user);
	if (!pending) return null;

	const normalized = normalizeText(message);
	if (["huy", "cancel", "bo qua", "thoi"].includes(normalized)) {
		clearPendingSelection(user);
		return "Mình đã hủy lựa chọn đang chờ.";
	}

	const selectedNumber = parseNumberSelection(message);
	if (!selectedNumber) {
		return "Mình đang chờ bạn chọn bằng số trong danh sách phía trên. Ví dụ: gửi `1` hoặc `2`.";
	}

	const choice = pending.choices?.[selectedNumber - 1];
	if (!choice) {
		return `Số này không có trong danh sách. Bạn chọn từ 1 đến ${pending.choices?.length || 0} nhé.`;
	}

	if (pending.type === "create_task_project") {
		return createTaskTool({
			user,
			params: {
				...(pending.params || {}),
				project_id: choice.id,
			},
			message: "",
		});
	}

	if (pending.type === "create_task_assignee") {
		return createTaskTool({
			user,
			params: {
				...(pending.params || {}),
				assignee_id: choice.id,
			},
			message: "",
		});
	}

	if (pending.type === "list_project_members_project") {
		clearPendingSelection(user);
		return listProjectMembersTool({
			user,
			params: {
				...(pending.params || {}),
				project_id: choice.id,
			},
			message: "",
		});
	}

	clearPendingSelection(user);
	return null;
}

async function executeTool({ intent, user, message }) {
	switch (intent?.action) {
		case "list_projects":
			return listProjectsTool({ user, params: intent.params || {} });
		case "list_tasks":
			return listTasksTool({ user, params: intent.params || {}, message });
		case "create_task":
			return createTaskTool({ user, params: intent.params || {}, message });
		case "list_project_members":
			return listProjectMembersTool({ user, params: intent.params || {}, message });
		case "preview_assignment":
			return previewAssignmentTool({ user, params: intent.params || {}, message });
		default:
			return null;
	}
}

const sendMessage = async (req, res) => {
	try {
		const message = String(req.body?.message || "").trim();
		if (!message) {
			return res.status(400).json({ success: false, error: "message is required" });
		}

		const pendingResponse = await handlePendingSelection({ user: req.user, message });
		if (pendingResponse) {
			return res.json({
				success: true,
				response: pendingResponse,
				provider: "local",
				model: "cpm-agent-selection",
				timestamp: new Date().toISOString(),
			});
		}

		const staticAnswer = getStaticAnswer(message);
		if (staticAnswer) {
			return res.json({
				success: true,
				response: staticAnswer,
				provider: "local",
				model: "cpm-agent-static",
				timestamp: new Date().toISOString(),
			});
		}

		const heuristicIntent = classifyIntentHeuristic(message);
		if (heuristicIntent) {
			const toolResponse = await executeTool({
				intent: heuristicIntent,
				user: req.user,
				message,
			});
			if (toolResponse) {
				return res.json({
					success: true,
					response: toolResponse,
					provider: "local",
					model: "cpm-agent-tools",
					action: heuristicIntent.action,
					timestamp: new Date().toISOString(),
				});
			}
		}

		const { modelName, model } = getGeminiModel();
		const intent = await classifyIntent(model, message, req.user?.role);
		const toolResponse = await executeTool({ intent, user: req.user, message });

		if (toolResponse) {
			return res.json({
				success: true,
				response: toolResponse,
				provider: "gemini",
				model: modelName,
				action: intent.action,
				timestamp: new Date().toISOString(),
			});
		}

		const result = await model.generateContent(
			buildPrompt({
				message,
				role: req.user?.role,
			})
		);
		const response = result.response.text();

		return res.json({
			success: true,
			response,
			provider: "gemini",
			model: modelName,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Error in chatbot message:", error);
		return res.status(500).json({
			success: false,
			error: error.message || "Failed to generate chatbot response",
		});
	}
};

module.exports = { sendMessage };
