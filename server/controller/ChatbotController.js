const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require("mongoose");
const Project = require("../models/project.model");
const Task = require("../models/task.model");
const Team = require("../models/team.model");
const User = require("../models/user.model");
const Skill = require("../models/skill.model");
const TaskNote = require("../models/taskNote.model");
const TaskAssignmentService = require("../services/TaskAssignmentService");
const {
	generateContent: generateOpenAICompatibleContent,
	isOpenAICompatibleConfigured,
	getOpenAICompatibleConfig,
} = require("../helpers/openAICompatibleClient");

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
- update_task for admin/manager
- delete_task for admin/manager with confirmation
- mark_task_done
- add_task_note
- create_project for admin/manager
- update_project for admin/manager
- delete_project for admin/manager with confirmation
- list_teams
- list_users
- list_skills
- create_skill for admin/manager
- preview_assignment without applying database changes
- apply_assignment for admin/manager with confirmation
- reassign_project for admin/manager with confirmation
- daily_report for today's project/task summary
- overdue_report for late tasks and late assignees
- personnel_stats for workload, overdue, due-today, and skill summary
- personal_report for one member's tasks in a date range

Do not say you have already applied, deleted, overridden, reassigned, or bulk-updated anything unless a future backend tool actually does that operation.
`;

function rolePolicy(role) {
	switch (String(role || "").toLowerCase()) {
		case "admin":
			return "Current role: admin. Full guidance allowed. Executable chatbot tools cover project/task CRUD, notes, assignment preview/apply/reassign, reports, team/user/skill listing, and skill creation.";
		case "manager":
			return "Current role: manager. Executable chatbot tools cover project/task CRUD, notes, assignment preview/apply/reassign, reports, team/user/skill listing, and skill creation within accessible team/project scope.";
		case "employee":
			return "Current role: employee. Read-only guidance only. Reports and stats must be limited to assigned or accessible work. Do not suggest direct create, update, delete, apply, override, or reassign actions.";
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
		.replace(/\u0111/g, "d")
		.replace(/\u0110/g, "d")
		.replace(/Ä‘/g, "d")
		.replace(/Ä/g, "d");
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

function wrapTextModel({ provider, modelName, generate }) {
	return {
		provider,
		modelName,
		model: {
			async generateContent(prompt) {
				const text = await generate(prompt);
				return {
					response: {
						text: () => text,
					},
				};
			},
		},
	};
}

function getAIModel() {
	if (isOpenAICompatibleConfigured()) {
		const config = getOpenAICompatibleConfig();
		return wrapTextModel({
			provider: "openai-compatible",
			modelName: config.chatModel,
			generate: (prompt) =>
				generateOpenAICompatibleContent(prompt, {
					model: config.chatModel,
					temperature: 0.25,
					maxOutputTokens: 900,
				}),
		});
	}

	const gemini = getGeminiModel();
	return {
		provider: "gemini",
		modelName: gemini.modelName,
		model: gemini.model,
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
  "action": "answer_only" | "list_projects" | "list_tasks" | "list_project_members" | "create_task" | "update_task" | "delete_task" | "mark_task_done" | "add_task_note" | "create_project" | "update_project" | "delete_project" | "list_teams" | "list_users" | "list_skills" | "create_skill" | "preview_assignment" | "apply_assignment" | "reassign_project" | "daily_report" | "overdue_report" | "personnel_stats" | "personal_report",
  "language": "vi" | "en",
  "params": {
    "project_name": string | null,
    "project_id": string | null,
    "project_name_new": string | null,
    "task_title": string | null,
    "task_id": string | null,
    "task_title_new": string | null,
    "description": string | null,
    "assignee_name": string | null,
    "assignee_id": string | null,
    "team_name": string | null,
    "team_id": string | null,
    "skill_name": string | null,
    "note_content": string | null,
    "due_date_iso": "YYYY-MM-DD" | null,
    "date_from_iso": "YYYY-MM-DD" | null,
    "date_to_iso": "YYYY-MM-DD" | null,
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
- If the user asks to update/edit/change a task, use "update_task".
- If the user asks to delete/remove a task, use "delete_task".
- If the user asks to complete/done/finish a task, use "mark_task_done".
- If the user asks to add a note/comment to a task, use "add_task_note".
- If the user asks to create/add a project, use "create_project".
- If the user asks to update/edit/change a project, use "update_project".
- If the user asks to delete/remove a project, use "delete_project".
- If the user asks to list teams, users, or skills, use "list_teams", "list_users", or "list_skills".
- If the user asks to create a skill, use "create_skill".
- If the user asks to preview/auto assign/recommend assignees, use "preview_assignment".
- If the user asks to apply/save assignment results, use "apply_assignment".
- If the user asks to reassign a project, use "reassign_project".
- If the user asks for today's summary, daily report, project status today, or "tong hop du an hom nay", use "daily_report".
- If the user asks whether anything is late/overdue, "tre han", or who is late, use "overdue_report".
- If the user asks for personnel/human-resource/member workload/statistics, "thong ke nhan su", use "personnel_stats".
- If the user asks for one member/person's report in a date range, use "personal_report" and put the member name in assignee_name.
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
		project_id: null,
		project_name_new: null,
		task_title: null,
		task_id: null,
		task_title_new: null,
		description: null,
		assignee_name: null,
		assignee_id: null,
		team_name: null,
		team_id: null,
		skill_name: null,
		note_content: null,
		due_date_iso: null,
		date_from_iso: null,
		date_to_iso: null,
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

function shouldReplacePendingSelection(message) {
	return Boolean(getStaticAnswer(message) || classifyIntentHeuristic(message));
}

function isAutoSuggestMessage(message) {
	const text = normalizeText(message);
	return (
		/\b(tu de xuat|de xuat giup|goi y giup|chon giup|tu chon|ban chon|recommend|suggest)\b/.test(text) ||
		(text.includes("de xuat") && !text.includes("project") && !text.includes("task"))
	);
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
	const text = normalizeText(message);
	const explicitLimit = text.match(/\b(?:top|limit|lay|hien thi|liet ke)\s*(\d{1,2})\b/);
	if (explicitLimit) {
		const limit = Number(explicitLimit[1]);
		return Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 12) : null;
	}
	const matches = [...text.matchAll(/\b(\d{1,2})\b/g)];
	const match = matches.find((item) => {
		const after = text.slice(item.index + item[0].length).trimStart();
		const before = text.slice(Math.max(0, item.index - 8), item.index).trimEnd();
		if (/^(ngay|day|days|tuan|week|weeks|thang|month|months|nguoi|member|members|person|people)\b/.test(after)) {
			return false;
		}
		if (/(den|toi|tu|trong|next|for)$/.test(before)) return false;
		return true;
	});
	if (!match) return null;
	const limit = Number(match[1]);
	if (!Number.isFinite(limit)) return null;
	return Math.min(Math.max(limit, 1), 12);
}

function inferAssigneeCountFromMessage(message) {
	const text = normalizeText(message);
	const numericMatch = text.match(/\b(\d{1,2})\s*(nguoi|member|members|person|people)\b/);
	if (numericMatch) {
		const count = Number(numericMatch[1]);
		if (Number.isFinite(count)) return Math.min(Math.max(count, 1), 3);
	}
	if (/\b(mot|one)\s*(nguoi|member|person)\b/.test(text)) return 1;
	return null;
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
	const asksApplyAssignment = /\b(apply|ap dung|luu phan cong)\b/.test(text) && /\b(assignment|phan cong|assign)\b/.test(text);
	const asksReassignProject = /\b(reassign|phan cong lai|gan lai)\b/.test(text) && mentionsProject;
	const asksAssignment =
		/\b(preview|phan cong|assignment|assign|auto assign|goi y|de xuat)\b/.test(text) &&
		(mentionsTask || mentionsProject || text.includes("mcmf")) &&
		!asksApplyAssignment &&
		!asksReassignProject;
	const asksReport =
		/\b(bao cao|report|tong hop|summary|tong quan|overview|hom nay|today|tinh hinh|deadline)\b/.test(text) &&
		(
			mentionsTask ||
			mentionsProject ||
			text.includes("du an") ||
			text.includes("cong viec") ||
			/\b(tong quan|overview|khoang|tu|den|tuan|thang|sap toi|toi day|ke tiep)\b/.test(text)
		);
	const asksPersonalReport =
		/\b(bao cao|report|tong hop|thong ke)\b/.test(text) &&
		/\b(ca nhan|mot nguoi|member|thanh vien|nhan vien|cua|cho)\b/.test(text) &&
		/\b(khoang|tu ngay|den ngay|tu|den|hom nay|tuan nay|thang nay|7 ngay|30 ngay|ngay qua)\b/.test(text);
	const asksOverdue =
		/\b(tre han|qua han|overdue|late|delay|cham deadline|ai tre)\b/.test(text);
	const asksPersonnelStats =
		/\b(thong ke nhan su|nhan su|workload|tai viec|tai cong viec|member workload|hieu suat|nguoi nao dang)\b/.test(text);
	const asksTeams = /\b(team|nhom|doi nhom)\b/.test(text) && /\b(danh sach|liet ke|xem|list|show)\b/.test(text);
	const asksUsers = /\b(user|users|nguoi dung|thanh vien|member|nhan su)\b/.test(text) && /\b(danh sach|liet ke|xem|list|show)\b/.test(text);
	const asksSkills = /\b(skill|skills|ky nang)\b/.test(text) && /\b(danh sach|liet ke|xem|list|show)\b/.test(text);
	const asksCreateSkill = /\b(tao|them|create|add)\b/.test(text) && /\b(skill|ky nang)\b/.test(text);
	const asksCreateProject = /\b(tao|them|create|add)\b/.test(text) && mentionsProject;
	const asksDeleteProject = /\b(xoa|delete|remove)\b/.test(text) && mentionsProject;
	const asksUpdateProject = /\b(sua|cap nhat|doi|update|edit|change)\b/.test(text) && mentionsProject;
	const asksDeleteTask = /\b(xoa|delete|remove)\b/.test(text) && mentionsTask;
	const asksUpdateTask = /\b(sua|cap nhat|doi|update|edit|change)\b/.test(text) && mentionsTask;
	const asksDoneTask = /\b(done|xong|hoan thanh|complete|finish)\b/.test(text) && mentionsTask;
	const asksNoteTask = /\b(note|ghi chu|comment|binh luan)\b/.test(text) && mentionsTask;

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

	if (asksApplyAssignment) return { action: "apply_assignment", language: "vi", params: getEmptyParams({ limit }) };
	if (asksReassignProject) return { action: "reassign_project", language: "vi", params: getEmptyParams({ limit }) };
	if (asksCreateSkill) return { action: "create_skill", language: "vi", params: getEmptyParams({ limit }) };
	if (asksSkills) return { action: "list_skills", language: "vi", params: getEmptyParams({ limit }) };
	if (asksTeams) return { action: "list_teams", language: "vi", params: getEmptyParams({ limit }) };
	if (asksUsers) return { action: "list_users", language: "vi", params: getEmptyParams({ limit }) };
	if (asksCreateProject) return { action: "create_project", language: "vi", params: getEmptyParams({ limit }) };
	if (asksDeleteProject) return { action: "delete_project", language: "vi", params: getEmptyParams({ limit }) };
	if (asksUpdateProject) return { action: "update_project", language: "vi", params: getEmptyParams({ limit }) };
	if (asksDeleteTask) return { action: "delete_task", language: "vi", params: getEmptyParams({ limit }) };
	if (asksDoneTask) return { action: "mark_task_done", language: "vi", params: getEmptyParams({ limit }) };
	if (asksNoteTask) return { action: "add_task_note", language: "vi", params: getEmptyParams({ limit }) };
	if (asksUpdateTask) return { action: "update_task", language: "vi", params: getEmptyParams({ limit }) };

	if (asksOverdue) {
		return {
			action: "overdue_report",
			language: "vi",
			params: getEmptyParams({ limit }),
		};
	}

	if (asksPersonalReport) {
		return {
			action: "personal_report",
			language: "vi",
			params: getEmptyParams({ limit }),
		};
	}

	if (asksPersonnelStats) {
		return {
			action: "personnel_stats",
			language: "vi",
			params: getEmptyParams({ limit }),
		};
	}

	if (asksReport) {
		return {
			action: "daily_report",
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
	const asksModelIdentity =
		/\b(model|mo hinh|llm|provider)\b/.test(text);
	const asksCapability =
		/\b(lam duoc gi|lam gi duoc|co the lam gi|giup duoc gi|chuc nang|kha nang|nang luc|capability|what can)\b/.test(text) ||
		(text.includes("lam duoc") && text.length <= 80);

	if (asksModelIdentity) {
		if (isOpenAICompatibleConfigured()) {
			const config = getOpenAICompatibleConfig();
			return [
				"Mình đang chạy qua cấu hình LLM của server.",
				`Provider hiện tại: \`openai-compatible\`.`,
				`Model backend đang gửi trong request: \`${config.chatModel}\`.`,
				"",
				"Nếu gateway phía sau tự alias hoặc route sang model nội bộ khác, mình chỉ biết tên model mà backend cấu hình để gọi.",
			].join("\n");
		}

		if (process.env.GEMINI_API_KEY) {
			return [
				"Mình đang chạy qua cấu hình LLM của server.",
				"Provider hiện tại: `gemini`.",
				`Model backend đang gửi trong request: \`${process.env.GEMINI_MODEL || "gemini-2.5-flash-lite"}\`.`,
			].join("\n");
		}

		return "Hiện server chưa cấu hình LLM provider nên mình không xác định được model đang chạy.";
	}

	if (asksCapability) {
		return [
			"Mình có thể hỗ trợ bạn quản lý công việc trong nhóm:",
			"1. Xem nhanh project và các task cần chú ý.",
			"2. Tìm task theo deadline, trạng thái hoặc theo project.",
			"3. Tạo task mới khi bạn nói rõ task thuộc project nào và giao cho ai.",
			"4. Gợi ý người phù hợp để nhận task trước khi bạn áp dụng phân công.",
			"5. Tổng hợp báo cáo hôm nay, task trễ hạn, ai đang trễ và thống kê nhân sự.",
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

function canManage(user) {
	return ["admin", "manager"].includes(String(user?.role || "").toLowerCase());
}

function normalizeId(value) {
	return value ? String(value._id || value.id || value) : "";
}

async function getAccessibleTeams(user) {
	if (user?.role === "admin") {
		return Team.find().populate("members", "name email role skills");
	}
	const teamIds = await getUserTeamIds(user?.id);
	return Team.find({ _id: { $in: teamIds } }).populate("members", "name email role skills");
}

async function resolveTeam({ user, teamId, teamName, message }) {
	const teams = await getAccessibleTeams(user);
	if (teamId) {
		return { team: teams.find((team) => normalizeId(team) === String(teamId)), teams };
	}
	if (teamName) {
		return {
			team: findByName(teams, teamName, "name") || inferItemFromMessage(teams, message, "name"),
			teams,
		};
	}
	return {
		team: inferItemFromMessage(teams, message, "name") || (teams.length === 1 ? teams[0] : null),
		teams,
	};
}

async function getAccessibleTasks(user) {
	const projects = await getAccessibleProjects(user);
	const projectIds = projects.map((project) => project._id);
	const query = { project: { $in: projectIds } };
	if (user?.role === "employee") {
		query.assigned_to = { $elemMatch: { $eq: new mongoose.Types.ObjectId(user.id) } };
	}
	const tasks = await Task.find(query)
		.populate("assigned_to", "name email role skills")
		.populate("project", "title teams team")
		.sort({ due_date: 1 });
	return { tasks, projects };
}

async function resolveTask({ user, taskId, taskTitle, projectName, message }) {
	const { tasks, projects } = await getAccessibleTasks(user);
	let scopedTasks = tasks;
	if (projectName) {
		const project = findByName(projects, projectName, "title") || inferItemFromMessage(projects, message, "title");
		if (project) {
			scopedTasks = tasks.filter((task) => normalizeId(task.project) === normalizeId(project));
		}
	}
	if (taskId) {
		return { task: scopedTasks.find((task) => normalizeId(task) === String(taskId)), tasks: scopedTasks };
	}
	if (taskTitle) {
		return {
			task: findByName(scopedTasks, taskTitle, "title") || inferItemFromMessage(scopedTasks, message, "title"),
			tasks: scopedTasks,
		};
	}
	return {
		task: inferItemFromMessage(scopedTasks, message, "title") || (scopedTasks.length === 1 ? scopedTasks[0] : null),
		tasks: scopedTasks,
	};
}

function parseStatus(value) {
	const text = normalizeText(value || "");
	if (!text) return null;
	if (/(completed|complete|done|finished|hoan thanh|xong)/.test(text)) return "completed";
	if (/(late|tre|qua han)/.test(text)) return "late";
	if (/(pause|paused|tam dung)/.test(text)) return "paused";
	if (/(progress|in progress|dang lam|dang thuc hien)/.test(text)) return "in progress";
	return value;
}

function buildTaskUpdates(params = {}) {
	const updates = {};
	if (params.task_title_new || params.new_task_title) {
		updates.title = params.task_title_new || params.new_task_title;
	}
	if (params.description) updates.description = params.description;
	if (params.status) updates.status = parseStatus(params.status);
	if (params.due_date_iso) updates.due_date = formatDateMillis(params.due_date_iso);
	if (params.priority) updates.priority = Math.min(Math.max(Number(params.priority), 1), 5);
	if (params.difficulty) updates.difficulty = Math.min(Math.max(Number(params.difficulty), 1), 4);
	if (Array.isArray(params.required_skills)) {
		const skills = params.required_skills.map((skill) => String(skill).trim()).filter(Boolean);
		updates.required_skills = skills;
		updates.skills_required = skills;
	}
	return updates;
}

function buildProjectUpdates(params = {}) {
	const updates = {};
	if (params.project_name_new || params.new_project_name) {
		updates.title = params.project_name_new || params.new_project_name;
	}
	if (params.description) updates.description = params.description;
	if (params.status) updates.status = parseStatus(params.status);
	if (params.due_date_iso) updates.due_date = formatDateMillis(params.due_date_iso);
	return updates;
}

function isConfirmationMessage(message) {
	const text = normalizeText(message);
	return ["xac nhan", "confirm", "yes", "ok", "dong y", "apply", "xoa", "co"].includes(text);
}

function askConfirmation(user, pending, lines) {
	setPendingSelection(user, pending);
	return [
		...lines,
		"",
		"\u004e\u1ebf\u0075 \u0063\u0068\u1eaf\u0063 \u0063\u0068\u1eaf\u006e, \u0068\u00e3\u0079 \u0067\u1eedi `\u0078\u00e1\u0063 \u006e\u0068\u1ead\u006e`. \u0047\u1eedi `\u0068\u1ee7\u0079` \u0111\u1ec3 \u0062\u1ecf \u0071\u0075\u0061.",
	].join("\n");
}

function formatDateMillis(dateIso, fallbackMillis) {
	if (!dateIso) return fallbackMillis || Date.now() + 86400000;
	const parsed = Date.parse(`${dateIso}T23:59:00+07:00`);
	return Number.isFinite(parsed) ? parsed : fallbackMillis || Date.now() + 86400000;
}

function taskStatus(task) {
	return String(task.status || "in progress");
}

function getTodayBounds() {
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	return {
		now,
		start,
		end: start + 24 * 60 * 60 * 1000 - 1,
		next7End: start + 8 * 24 * 60 * 60 * 1000 - 1,
	};
}

function isCompletedTask(task) {
	const status = normalizeText(task?.status || "");
	return ["completed", "done", "finished", "complete", "hoan thanh", "da xong"].some((item) =>
		status.includes(item)
	);
}

function isTaskOverdue(task, todayStart = getTodayBounds().start) {
	const due = Number(task?.due_date);
	return Number.isFinite(due) && due < todayStart && !isCompletedTask(task);
}

function isTaskDueToday(task, bounds = getTodayBounds()) {
	const due = Number(task?.due_date);
	return Number.isFinite(due) && due >= bounds.start && due <= bounds.end && !isCompletedTask(task);
}

function formatDate(value) {
	if (!value) return "chưa có deadline";
	return new Date(value).toLocaleDateString("vi-VN");
}

function parseIsoDateMillis(dateIso, endOfDay = false) {
	if (!dateIso) return null;
	const suffix = endOfDay ? "T23:59:59+07:00" : "T00:00:00+07:00";
	const parsed = Date.parse(`${dateIso}${suffix}`);
	return Number.isFinite(parsed) ? parsed : null;
}

function getWeekStart(date) {
	const day = date.getDay() || 7;
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day + 1).getTime();
}

function parseDuration(text) {
	const match = text.match(/\b(\d{1,2}|mot)\s*(tuan|week|weeks|ngay|day|days)\b/);
	if (!match) return null;
	const amount = match[1] === "mot" ? 1 : Number(match[1]);
	if (!Number.isFinite(amount)) return null;
	const unit = match[2];
	return (unit.includes("tuan") || unit.includes("week")) ? amount * 7 : amount;
}

function parseDateRangeFromMessage(message, params = {}) {
	const text = normalizeText(message);
	const now = new Date();
	const nowMs = now.getTime();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	let start = parseIsoDateMillis(params.date_from_iso || params.from_date || params.start_date);
	let end = parseIsoDateMillis(params.date_to_iso || params.to_date || params.end_date, true);

	const isoRange = text.match(/\b(20\d{2}-\d{2}-\d{2})\b.*?\b(20\d{2}-\d{2}-\d{2})\b/);
	if ((!start || !end) && isoRange) {
		start = parseIsoDateMillis(isoRange[1]);
		end = parseIsoDateMillis(isoRange[2], true);
	}

	const slashRange = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b.*?\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
	if ((!start || !end) && slashRange) {
		const currentYear = now.getFullYear();
		const fromYear = Number(slashRange[3] || currentYear);
		const toYear = Number(slashRange[6] || fromYear);
		start = new Date(fromYear, Number(slashRange[2]) - 1, Number(slashRange[1])).getTime();
		end = new Date(toYear, Number(slashRange[5]) - 1, Number(slashRange[4]), 23, 59, 59, 999).getTime();
	}

	if (!start || !end) {
		const durationDays = parseDuration(text);
		const fromNow = /\b(tu day|tu bay gio|tu gio|bay gio|hien tai|luc nay|from now|now)\b/.test(text);
		const futureContext = /\b(sap toi|toi day|ke tiep|next|upcoming|den|toi|trong)\b/.test(text);
		const pastContext = /\b(qua|gan day|vua roi|last|recent)\b/.test(text);

		if (durationDays && (fromNow || futureContext) && !pastContext) {
			start = fromNow ? nowMs : todayStart;
			end = start + Math.max(1, durationDays) * 24 * 60 * 60 * 1000;
		} else if (durationDays && pastContext) {
			end = nowMs;
			start = end - Math.max(1, durationDays) * 24 * 60 * 60 * 1000;
		} else if (futureContext || text.includes("tuan toi")) {
			start = nowMs;
			end = start + 7 * 24 * 60 * 60 * 1000;
		} else if (text.includes("hom nay") || text.includes("today")) {
			start = todayStart;
			end = todayStart + 24 * 60 * 60 * 1000 - 1;
		} else if (text.includes("tuan nay") || text.includes("this week")) {
			start = getWeekStart(now);
			end = start + 7 * 24 * 60 * 60 * 1000 - 1;
		} else if (text.includes("tuan sau") || text.includes("next week")) {
			start = getWeekStart(now) + 7 * 24 * 60 * 60 * 1000;
			end = start + 7 * 24 * 60 * 60 * 1000 - 1;
		} else if (text.includes("thang nay") || text.includes("this month")) {
			start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
			end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;
		} else if (text.includes("thang sau") || text.includes("next month")) {
			start = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
			end = new Date(now.getFullYear(), now.getMonth() + 2, 1).getTime() - 1;
		} else {
			end = nowMs;
			start = end - 7 * 24 * 60 * 60 * 1000;
		}
	}

	if (start > end) [start, end] = [end, start];
	return { start, end };
}

function formatAssignees(task) {
	const assignees = (task?.assigned_to || [])
		.map((user) => user?.name || user?.email)
		.filter(Boolean)
		.join(", ");
	return assignees || "chưa có người làm";
}

async function getReportScope({ user, params, message }) {
	const { project, projects } = await resolveProject({
		user,
		projectId: params?.project_id,
		projectName: params?.project_name,
		message,
	});
	const scopedProjects = project ? [project] : projects;
	const projectIds = scopedProjects.map((item) => item._id);
	const query = { project: { $in: projectIds } };
	if (user?.role === "employee") {
		query.assigned_to = { $elemMatch: { $eq: new mongoose.Types.ObjectId(user.id) } };
	}
	return {
		project,
		projects: scopedProjects,
		projectIds,
		query,
	};
}

function groupOverdueByAssignee(tasks) {
	const groups = new Map();
	for (const task of tasks) {
		const assignees = task.assigned_to?.length ? task.assigned_to : [{ name: "Chưa rõ người làm" }];
		for (const assignee of assignees) {
			const key = String(assignee?._id || assignee?.id || assignee?.name || "unknown");
			const current = groups.get(key) || {
				name: assignee?.name || assignee?.email || "Chưa rõ người làm",
				count: 0,
				tasks: [],
			};
			current.count += 1;
			current.tasks.push(task);
			groups.set(key, current);
		}
	}
	return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
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

async function listTeamsTool({ user, params }) {
	const limit = Math.min(Number(params?.limit) || 8, 12);
	const teams = (await getAccessibleTeams(user)).slice(0, limit);
	if (teams.length === 0) return "Mình chưa tìm thấy team nào bạn có quyền xem.";
	return [
		`Mình tìm thấy ${teams.length} team:`,
		...teams.map((team, index) => {
			const members = (team.members || []).map((member) => member.name || member.email).filter(Boolean);
			return `${index + 1}. ${team.name} (${members.length} thành viên${members.length ? `: ${members.slice(0, 4).join(", ")}` : ""})`;
		}),
	].join("\n");
}

async function listUsersTool({ user, params }) {
	const limit = Math.min(Number(params?.limit) || 10, 15);
	let users = [];
	if (user?.role === "admin") {
		users = await User.find().select("name email role skills current_task_count productivity_score on_time_rate").limit(limit);
	} else {
		const teams = await getAccessibleTeams(user);
		const memberIds = [
			...new Set(teams.flatMap((team) => (team.members || []).map((member) => normalizeId(member)))),
		];
		users = await User.find({ _id: { $in: memberIds } })
			.select("name email role skills current_task_count productivity_score on_time_rate")
			.limit(limit);
	}
	if (users.length === 0) return "Mình chưa tìm thấy user nào trong phạm vi bạn có quyền xem.";
	return [
		`Danh sách ${users.length} user:`,
		...users.map((member, index) => {
			const skills = (member.skills || []).map((skill) => skill.name).filter(Boolean).slice(0, 3).join(", ");
			return `${index + 1}. ${member.name || member.email} (${member.role || "member"}, ${member.current_task_count || 0} task${skills ? `, skill: ${skills}` : ""})`;
		}),
	].join("\n");
}

async function listSkillsTool({ params }) {
	const limit = Math.min(Number(params?.limit) || 15, 30);
	const skills = await Skill.find().sort({ name: 1 }).limit(limit);
	if (skills.length === 0) return "Chưa có kỹ năng nào trong hệ thống.";
	return [
		`Danh sách ${skills.length} kỹ năng:`,
		...skills.map((skill, index) => `${index + 1}. ${skill.name}${skill.description ? ` - ${skill.description}` : ""}`),
	].join("\n");
}

async function createSkillTool({ user, params, message }) {
	if (!canManage(user)) {
		return "Tài khoản hiện tại chỉ có quyền xem, không thể tạo kỹ năng.";
	}
	const name = params?.skill_name || params?.name || inferQuotedText(message) || null;
	if (!name) return "Bạn muốn tạo kỹ năng tên gì?";
	const skill = await Skill.findOneAndUpdate(
		{ name: new RegExp(`^${escapeRegex(name)}$`, "i") },
		{ $setOnInsert: { name, description: params?.description || "" } },
		{ upsert: true, new: true }
	);
	return `Đã sẵn sàng kỹ năng "${skill.name}" trong hệ thống.`;
}

function inferQuotedText(message) {
	const match = String(message || "").match(/["“”']([^"“”']+)["“”']/);
	return match?.[1]?.trim() || null;
}

async function createProjectTool({ user, params, message }) {
	if (!canManage(user)) {
		return "Tài khoản hiện tại chỉ có quyền xem, không thể tạo project.";
	}
	const title = params?.project_name || params?.title || inferQuotedText(message);
	if (!title) return "Bạn muốn tạo project tên gì?";

	const { team, teams } = await resolveTeam({
		user,
		teamId: params?.team_id,
		teamName: params?.team_name,
		message,
	});
	if (!team) {
		const choices = teams.slice(0, 8);
		if (choices.length === 0) return "Mình chưa tìm thấy team phù hợp để tạo project.";
		setPendingSelection(user, {
			type: "create_project_team",
			params: { ...params, project_name: title },
			choices: choices.map((item) => ({ id: normalizeId(item), label: item.name })),
		});
		return [
			`Project "${title}" nên thuộc team nào? Chọn số giúp mình:`,
			formatNumberedChoices(choices, (item) => item.name),
		].join("\n");
	}

	const project = await Project.create({
		title,
		description: params?.description || title,
		due_date: formatDateMillis(params?.due_date_iso, Date.now() + 7 * 86400000),
		status: params?.status ? parseStatus(params.status) : "in progress",
		team: team._id,
		teams: [team._id],
		stages: Project.normalizeStages(Project.DEFAULT_STAGES),
		customer: Project.normalizeCustomer(null),
	});
	clearPendingSelection(user);
	return `Đã tạo project "${project.title}" cho team "${team.name}", deadline ${formatDate(project.due_date)}.`;
}

async function updateProjectTool({ user, params, message }) {
	if (!canManage(user)) return "Tài khoản hiện tại chỉ có quyền xem, không thể cập nhật project.";
	const { project, projects } = await resolveProject({
		user,
		projectId: params?.project_id,
		projectName: params?.project_name,
		message,
	});
	if (!project) {
		const choices = projects.slice(0, 8);
		setPendingSelection(user, {
			type: "update_project_project",
			params,
			choices: choices.map((item) => ({
				id: item._id.toString(),
				label: item.title,
			})),
		});
		if (choices.length === 0) return "Mình chưa tìm thấy project phù hợp để cập nhật.";
		return [
			"Bạn muốn cập nhật project nào? Hãy nói rõ tên project, hoặc chọn trong danh sách:",
			formatNumberedChoices(choices, (item) => item.title),
		].join("\n");
	}

	const updates = buildProjectUpdates(params);
	if (Object.keys(updates).length === 0) {
		return `Bạn muốn cập nhật gì cho project "${project.title}"? Có thể đổi title, description, status hoặc deadline.`;
	}
	const updated = await Project.findByIdAndUpdate(project._id, updates, { new: true, runValidators: true });
	return `Đã cập nhật project "${updated.title}" (${updated.status || "in progress"}, deadline ${formatDate(updated.due_date)}).`;
}

async function deleteProjectTool({ user, params, message, confirmed = false }) {
	if (!canManage(user)) return "Tài khoản hiện tại chỉ có quyền xem, không thể xóa project.";
	const { project } = await resolveProject({
		user,
		projectId: params?.project_id,
		projectName: params?.project_name,
		message,
	});
	if (!project) return "Mình chưa tìm thấy project cần xóa. Hãy nói rõ tên project.";
	if (!confirmed) {
		const taskCount = await Task.countDocuments({ project: project._id });
		return askConfirmation(
			user,
			{ type: "confirm_delete_project", params: { project_id: normalizeId(project) } },
			[`Bạn đang yêu cầu xóa project "${project.title}" cùng ${taskCount} task liên quan.`]
		);
	}
	await Project.findByIdAndDelete(project._id);
	await Task.deleteMany({ project: project._id });
	return `Đã xóa project "${project.title}" và các task liên quan.`;
}

async function updateTaskTool({ user, params, message }) {
	if (!canManage(user)) return "Tài khoản hiện tại chỉ có quyền xem, không thể cập nhật task.";
	const { task } = await resolveTask({
		user,
		taskId: params?.task_id,
		taskTitle: params?.task_title,
		projectName: params?.project_name,
		message,
	});
	if (!task) return "Mình chưa tìm thấy task cần cập nhật. Hãy nói rõ tên task hoặc project.";

	const updates = buildTaskUpdates(params);
	if (params?.assignee_name) {
		const project = await Project.findById(task.project?._id || task.project);
		const assignee = await resolveAssignee({ assigneeName: params.assignee_name, project, message });
		if (!assignee) return `Mình chưa tìm thấy assignee "${params.assignee_name}" trong project.`;
		updates.assigned_to = [assignee._id];
	}
	if (Object.keys(updates).length === 0) {
		return `Bạn muốn cập nhật gì cho task "${task.title}"? Có thể đổi status, deadline, priority, difficulty, description hoặc assignee.`;
	}

	const updated = await Task.findByIdAndUpdate(task._id, updates, { new: true, runValidators: true })
		.populate("assigned_to", "name email");
	return `Đã cập nhật task "${updated.title}" (${updated.status || "in progress"}, deadline ${formatDate(updated.due_date)}, người làm: ${formatAssignees(updated)}).`;
}

async function deleteTaskTool({ user, params, message, confirmed = false }) {
	if (!canManage(user)) return "Tài khoản hiện tại chỉ có quyền xem, không thể xóa task.";
	const { task } = await resolveTask({
		user,
		taskId: params?.task_id,
		taskTitle: params?.task_title,
		projectName: params?.project_name,
		message,
	});
	if (!task) return "Mình chưa tìm thấy task cần xóa. Hãy nói rõ tên task.";
	if (!confirmed) {
		return askConfirmation(
			user,
			{ type: "confirm_delete_task", params: { task_id: normalizeId(task) } },
			[`Bạn đang yêu cầu xóa task "${task.title}".`]
		);
	}
	await Task.findByIdAndDelete(task._id);
	await TaskNote.deleteMany({ task: task._id });
	return `Đã xóa task "${task.title}".`;
}

async function markTaskDoneTool({ user, params, message }) {
	const { task } = await resolveTask({
		user,
		taskId: params?.task_id,
		taskTitle: params?.task_title,
		projectName: params?.project_name,
		message,
	});
	if (!task) return "Mình chưa tìm thấy task cần hoàn thành. Hãy nói rõ tên task.";
	if (user?.role === "employee") {
		const isAssigned = (task.assigned_to || []).some((assignee) => normalizeId(assignee) === String(user.id));
		if (!isAssigned) return "Bạn chỉ có thể đánh dấu hoàn thành task được giao cho mình.";
	}
	const nextStatus = Number(task.due_date || 0) < Date.now() ? "late" : "completed";
	const updated = await Task.findByIdAndUpdate(task._id, { status: nextStatus }, { new: true });
	return `Đã đánh dấu task "${updated.title}" là ${updated.status}.`;
}

async function addTaskNoteTool({ user, params, message }) {
	const { task } = await resolveTask({
		user,
		taskId: params?.task_id,
		taskTitle: params?.task_title,
		projectName: params?.project_name,
		message,
	});
	if (!task) return "Mình chưa tìm thấy task cần thêm ghi chú. Hãy nói rõ tên task.";
	const content = params?.note_content || params?.description || inferQuotedText(message);
	if (!content) return `Bạn muốn thêm ghi chú gì cho task "${task.title}"?`;
	const note = await TaskNote.create({
		task: task._id,
		author: new mongoose.Types.ObjectId(user.id),
		content,
		mentions: [],
	});
	return `Đã thêm ghi chú cho task "${task.title}": ${note.content}`;
}

async function dailyReportTool({ user, params, message }) {
	const bounds = getTodayBounds();
	const range = parseDateRangeFromMessage(message, params);
	const scope = await getReportScope({ user, params, message });
	if (scope.projects.length === 0) {
		return "\u004d\u00ec\u006e\u0068 \u0063\u0068\u01b0\u0061 \u0074\u00ec\u006d \u0074\u0068\u1ea5\u0079 \u0070\u0072\u006f\u006a\u0065\u0063\u0074 \u006e\u00e0\u006f \u0074\u0072\u006f\u006e\u0067 \u0070\u0068\u1ea1\u006d \u0076\u0069 \u0062\u1ea1\u006e \u0063\u00f3 \u0071\u0075\u0079\u1ec1\u006e \u0078\u0065\u006d \u0111\u1ec3 \u0074\u1ed5\u006e\u0067 \u0068\u1ee3\u0070.";
	}

	const tasks = await Task.find({
		...scope.query,
		due_date: { $gte: range.start, $lte: range.end },
	})
		.populate("assigned_to", "name email")
		.sort({ due_date: 1 });
	const activeTasks = tasks.filter((task) => !isCompletedTask(task));
	const dueInRange = activeTasks;
	const overdue = activeTasks.filter((task) => isTaskOverdue(task, bounds.start));
	const completed = tasks.filter(isCompletedTask);
	const projectLabel = scope.project
		? `project "${scope.project.title}"`
		: `${scope.projects.length} project`;

	const lines = [
		`\u0042\u00e1\u006f \u0063\u00e1\u006f \u0074\u1ed5\u006e\u0067 \u0071\u0075\u0061\u006e (${formatDate(range.start)} - ${formatDate(range.end)}) \u0063\u0068\u006f ${projectLabel}:`,
		`- \u0054\u1ed5\u006e\u0067 \u0074\u0061\u0073\u006b: ${tasks.length}; \u0111\u0061\u006e\u0067 \u006d\u1edf: ${activeTasks.length}; \u0068\u006f\u00e0\u006e \u0074\u0068\u00e0\u006e\u0068: ${completed.length}.`,
		`- \u0110\u1ebf\u006e \u0068\u1ea1\u006e \u0074\u0072\u006f\u006e\u0067 \u006b\u0068\u006f\u1ea3\u006e\u0067: ${dueInRange.length}; \u0074\u0072\u1ec5 \u0068\u1ea1\u006e: ${overdue.length}.`,
	];

	if (dueInRange.length > 0) {
		lines.push("", "\u0054\u0061\u0073\u006b \u0111\u1ebf\u006e \u0068\u1ea1\u006e \u0074\u0072\u006f\u006e\u0067 \u006b\u0068\u006f\u1ea3\u006e\u0067:");
		dueInRange.slice(0, Math.min(Number(params?.limit) || 8, 12)).forEach((task) => {
			lines.push(`- ${task.title} - ${formatAssignees(task)} (${taskStatus(task)}, deadline ${formatDate(task.due_date)})`);
		});
	}

	if (overdue.length > 0) {
		lines.push("", "\u0110\u0061\u006e\u0067 \u0074\u0072\u1ec5 \u0068\u1ea1\u006e:");
		overdue.slice(0, 5).forEach((task) => {
			lines.push(`- ${task.title} - deadline ${formatDate(task.due_date)}, \u006e\u0067\u01b0\u1eddi \u006c\u00e0\u006d: ${formatAssignees(task)}`);
		});
		const latePeople = groupOverdueByAssignee(overdue)
			.slice(0, 5)
			.map((item) => `${item.name}: ${item.count} task`)
			.join("; ");
		lines.push(`\u0041\u0069 \u0111\u0061\u006e\u0067 \u0074\u0072\u1ec5: ${latePeople}.`);
	} else {
		lines.push("", "\u0048\u0069\u1ec7\u006e \u0063\u0068\u01b0\u0061 \u0063\u00f3 \u0074\u0061\u0073\u006b \u0074\u0072\u1ec5 \u0068\u1ea1\u006e \u0074\u0072\u006f\u006e\u0067 \u006b\u0068\u006f\u1ea3\u006e\u0067 \u006e\u00e0\u0079.");
	}

	return lines.join("\n");
}

async function overdueReportTool({ user, params, message }) {
	const bounds = getTodayBounds();
	const scope = await getReportScope({ user, params, message });
	if (scope.projects.length === 0) {
		return "Mình chưa tìm thấy project nào trong phạm vi bạn có quyền xem để kiểm tra trễ hạn.";
	}

	const tasks = await Task.find(scope.query)
		.populate("assigned_to", "name email")
		.populate("project", "title")
		.sort({ due_date: 1 });
	const overdue = tasks.filter((task) => isTaskOverdue(task, bounds.start));
	if (overdue.length === 0) {
		return "Hiện chưa có task trễ hạn trong phạm vi bạn có quyền xem.";
	}

	const latePeople = groupOverdueByAssignee(overdue);
	const lines = [
		`Có ${overdue.length} task đang trễ hạn.`,
		"Ai đang trễ:",
		...latePeople.slice(0, 8).map((item, index) => `${index + 1}. ${item.name}: ${item.count} task`),
		"",
		"Task trễ hạn cần xem trước:",
	];
	overdue.slice(0, Math.min(Number(params?.limit) || 8, 12)).forEach((task) => {
		const projectTitle = task.project?.title ? `, project: ${task.project.title}` : "";
		lines.push(`- ${task.title} - deadline ${formatDate(task.due_date)}, người làm: ${formatAssignees(task)}${projectTitle}`);
	});

	return lines.join("\n");
}

async function personnelStatsTool({ user, params, message }) {
	const bounds = getTodayBounds();
	const scope = await getReportScope({ user, params, message });
	if (scope.projects.length === 0) {
		return "Mình chưa tìm thấy project nào trong phạm vi bạn có quyền xem để thống kê nhân sự.";
	}

	let users = [];
	if (scope.project) {
		users = await getProjectMembers(scope.project);
	} else {
		const teamIds = [
			...new Set(scope.projects.flatMap((project) => getProjectTeamIds(project))),
		];
		const teams = await Team.find({ _id: { $in: teamIds } }).select("members");
		const memberIds = [
			...new Set(
				teams.flatMap((team) => (team.members || []).map((member) => member.toString()))
			),
		];
		users = await User.find({ _id: { $in: memberIds } }).select(
			"name email role skills current_task_count productivity_score on_time_rate"
		);
	}

	if (user?.role === "employee") {
		users = users.filter((item) => item._id.toString() === String(user.id));
	}

	const tasks = await Task.find(scope.query)
		.populate("assigned_to", "name email")
		.sort({ due_date: 1 });
	const stats = new Map();
	for (const member of users) {
		stats.set(member._id.toString(), {
			member,
			total: 0,
			active: 0,
			overdue: 0,
			dueToday: 0,
			completed: 0,
		});
	}

	for (const task of tasks) {
		for (const assignee of task.assigned_to || []) {
			const key = String(assignee?._id || assignee?.id || "");
			if (!stats.has(key)) continue;
			const item = stats.get(key);
			item.total += 1;
			if (isCompletedTask(task)) {
				item.completed += 1;
			} else {
				item.active += 1;
				if (isTaskOverdue(task, bounds.start)) item.overdue += 1;
				if (isTaskDueToday(task, bounds)) item.dueToday += 1;
			}
		}
	}

	const rows = [...stats.values()].sort(
		(a, b) =>
			b.overdue - a.overdue ||
			b.active - a.active ||
			String(a.member.name || a.member.email || "").localeCompare(
				String(b.member.name || b.member.email || "")
			)
	);
	const totalActive = rows.reduce((sum, item) => sum + item.active, 0);
	const totalOverdue = rows.reduce((sum, item) => sum + item.overdue, 0);
	const lines = [
		`Thống kê nhân sự (${scope.project ? scope.project.title : `${scope.projects.length} project`}):`,
		`- Số thành viên: ${rows.length}; task đang mở: ${totalActive}; task trễ hạn: ${totalOverdue}.`,
	];

	rows.slice(0, Math.min(Number(params?.limit) || 10, 12)).forEach((item, index) => {
		const member = item.member;
		const skills = (member.skills || []).map((skill) => skill.name).filter(Boolean).slice(0, 3).join(", ");
		const rate = Number.isFinite(member.on_time_rate) ? `, đúng hạn ${member.on_time_rate}%` : "";
		const productivity = Number.isFinite(member.productivity_score)
			? `, năng suất ${member.productivity_score}`
			: "";
		lines.push(
			`${index + 1}. ${member.name || member.email}: active ${item.active}, hôm nay ${item.dueToday}, trễ ${item.overdue}, hoàn thành ${item.completed}${rate}${productivity}${skills ? `, skill: ${skills}` : ""}`
		);
	});

	return lines.join("\n");
}

async function getAccessibleReportUsers(user, scope) {
	if (user?.role === "employee") {
		return User.find({ _id: user.id }).select(
			"name email role skills current_task_count productivity_score on_time_rate"
		);
	}

	if (scope.project) {
		return getProjectMembers(scope.project);
	}

	const teamIds = [
		...new Set(scope.projects.flatMap((project) => getProjectTeamIds(project))),
	];
	const teams = await Team.find({ _id: { $in: teamIds } }).select("members");
	const memberIds = [
		...new Set(
			teams.flatMap((team) => (team.members || []).map((member) => member.toString()))
		),
	];
	return User.find({ _id: { $in: memberIds } }).select(
		"name email role skills current_task_count productivity_score on_time_rate"
	);
}

function inferReportMember(users, params, message) {
	if (params?.assignee_id) {
		return users.find((member) => normalizeId(member) === String(params.assignee_id));
	}
	const targetName = params?.assignee_name || params?.user_name || params?.member_name;
	if (targetName) {
		return (
			findByName(users, targetName, "name") ||
			findByName(users, targetName, "email")
		);
	}
	return inferItemFromMessage(users, message, "name") || inferItemFromMessage(users, message, "email");
}

async function personalReportTool({ user, params, message }) {
	const scope = await getReportScope({ user, params, message });
	if (scope.projects.length === 0) {
		return "Mình chưa tìm thấy project nào trong phạm vi bạn có quyền xem để lập báo cáo cá nhân.";
	}

	const users = await getAccessibleReportUsers(user, scope);
	const member = user?.role === "employee"
		? users[0]
		: inferReportMember(users, params, message);

	if (!member) {
		const choices = users.slice(0, 8);
		if (choices.length === 0) return "Mình chưa tìm thấy thành viên nào trong phạm vi bạn có quyền xem.";
		return [
			"Bạn muốn xem báo cáo cá nhân của ai? Hãy nói rõ tên, ví dụ: `báo cáo cá nhân Nam Trần tuần này`.",
			"Danh sách gợi ý:",
			...choices.map((item, index) => `${index + 1}. ${item.name || item.email}`),
		].join("\n");
	}

	const range = parseDateRangeFromMessage(message, params);
	const query = {
		...scope.query,
		assigned_to: { $elemMatch: { $eq: new mongoose.Types.ObjectId(member._id) } },
		due_date: { $gte: range.start, $lte: range.end },
	};
	const tasks = await Task.find(query)
		.populate("project", "title")
		.sort({ due_date: 1 });
	const completed = tasks.filter(isCompletedTask);
	const active = tasks.filter((task) => !isCompletedTask(task));
	const overdue = active.filter((task) => isTaskOverdue(task));
	const avgPriority = tasks.length
		? (tasks.reduce((sum, task) => sum + (Number(task.priority) || 0), 0) / tasks.length).toFixed(1)
		: "0";
	const avgDifficulty = tasks.length
		? (tasks.reduce((sum, task) => sum + (Number(task.difficulty) || 0), 0) / tasks.length).toFixed(1)
		: "0";
	const skills = (member.skills || []).map((skill) => skill.name).filter(Boolean).slice(0, 5).join(", ");

	const lines = [
		`Báo cáo cá nhân: ${member.name || member.email}`,
		`Khoảng thời gian: ${formatDate(range.start)} - ${formatDate(range.end)} (theo deadline task).`,
		`- Tổng task: ${tasks.length}; đang mở: ${active.length}; hoàn thành: ${completed.length}; trễ hạn: ${overdue.length}.`,
		`- Priority trung bình: ${avgPriority}; độ khó trung bình: ${avgDifficulty}; workload hiện tại: ${member.current_task_count || 0} task.`,
		`- Hồ sơ: năng suất ${member.productivity_score ?? "chưa có"}, đúng hạn ${member.on_time_rate ?? "chưa có"}%${skills ? `, kỹ năng: ${skills}` : ""}.`,
	];

	if (tasks.length > 0) {
		lines.push("", "Task trong khoảng:");
		tasks.slice(0, Math.min(Number(params?.limit) || 8, 12)).forEach((task) => {
			const projectTitle = task.project?.title ? `, project: ${task.project.title}` : "";
			lines.push(`- ${task.title} (${taskStatus(task)}, deadline ${formatDate(task.due_date)}${projectTitle})`);
		});
	} else {
		lines.push("", "Không có task nào của người này có deadline trong khoảng thời gian trên.");
	}

	return lines.join("\n");
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
	const assigneeCount = inferAssigneeCountFromMessage(message) || 2;
	let tasks = [];
	if (params?.task_id || params?.task_title) {
		const projectIds = project
			? [project._id]
			: projects.map((item) => item._id);
		tasks = await Task.find({
			project: { $in: projectIds },
			...(params?.task_id
				? { _id: params.task_id }
				: { title: new RegExp(escapeRegex(params.task_title), "i") }),
			status: { $ne: "completed" },
		}).limit(limit);
	} else {
		const resolved = await resolveTask({
			user,
			taskId: null,
			taskTitle: null,
			projectName: params?.project_name,
			message,
		});
		if (resolved.task) tasks = [resolved.task];
	}

	if (tasks.length === 0 && project) {
		tasks = await Task.find({
			project: project._id,
			status: { $ne: "completed" },
		})
			.sort({ due_date: 1 })
			.limit(limit);
	} else if (project) {
		tasks = tasks.filter((task) => normalizeId(task.project) === normalizeId(project));
	}

	if (tasks.length === 0) {
		return "Mình chưa tìm thấy task phù hợp để preview assignment. Hãy nói rõ tên project hoặc tên task.";
	}

	const result = await TaskAssignmentService.assignTasksHybrid(
		tasks.map((task) => task._id.toString()),
		null,
		{
			maxParallelAssignees: assigneeCount,
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

function formatScorePercent(value) {
	const number = Number(value || 0);
	return `${Math.round(Math.max(0, Math.min(1, number)) * 100)}%`;
}

async function chooseSuggestedAssigneesForPendingTask(pending, limit = 3) {
	const params = pending.params || {};
	const project = params.project_id ? await Project.findById(params.project_id) : null;
	if (!project) return [];

	const allowedIds = new Set((pending.choices || []).map((choice) => String(choice.id)));
	const members = (await getProjectMembers(project)).filter((member) =>
		allowedIds.size === 0 || allowedIds.has(member._id.toString())
	);
	if (members.length === 0) return [];

	const taskLike = TaskAssignmentService.normalizeTaskPayload({
		title: params.task_title,
		description: params.description || params.task_title,
		required_skills: params.required_skills || [],
		priority: params.priority || 3,
		difficulty: params.difficulty || 2,
		due_date: formatDateMillis(params.due_date_iso, project.due_date),
		can_parallelize: true,
	});
	const candidates = await TaskAssignmentService.findAvailableCandidates(
		taskLike,
		members,
		{ maxCostThreshold: 1 }
	);
	const bestMatches = await TaskAssignmentService.findBestMatchByEmbedding(
		taskLike,
		candidates,
		{
			maxParallelAssignees: Math.min(limit, members.length),
			minScoreThreshold: 0,
			disableExternalEmbedding: true,
		}
	);
	return bestMatches;
}

async function getAssignmentTaskIds({ user, params, message, maxTasks = 5 }) {
	if (Array.isArray(params?.task_ids) && params.task_ids.length > 0) {
		const { tasks: accessibleTasks } = await getAccessibleTasks(user);
		const allowed = accessibleTasks.filter((task) => params.task_ids.includes(normalizeId(task)));
		return { tasks: allowed, project: null };
	}
	const { project, projects } = await resolveProject({
		user,
		projectId: params?.project_id,
		projectName: params?.project_name,
		message,
	});
	let tasks = [];
	if (params?.task_id || params?.task_title) {
		const resolved = await resolveTask({
			user,
			taskId: params?.task_id,
			taskTitle: params?.task_title,
			projectName: params?.project_name,
			message,
		});
		if (resolved.task) tasks = [resolved.task];
	} else if (project) {
		tasks = await Task.find({
			project: project._id,
			status: { $ne: "completed" },
		})
			.sort({ due_date: 1 })
			.limit(maxTasks);
	} else {
		const projectIds = projects.map((item) => item._id);
		tasks = await Task.find({
			project: { $in: projectIds },
			status: { $ne: "completed" },
		})
			.sort({ due_date: 1 })
			.limit(maxTasks);
	}
	return { tasks, project };
}

async function applyAssignmentTool({ user, params, message, confirmed = false }) {
	if (!canManage(user)) {
		return "Role hiện tại chỉ có quyền xem, không thể áp dụng phân công tự động.";
	}
	const { tasks, project } = await getAssignmentTaskIds({ user, params, message, maxTasks: 5 });
	if (tasks.length === 0) {
		return "Mình chưa tìm thấy task phù hợp để apply assignment. Hãy nói rõ tên project hoặc task.";
	}
	if (!confirmed) {
		return askConfirmation(
			user,
			{
				type: "confirm_apply_assignment",
				params: { task_ids: tasks.map((task) => normalizeId(task)) },
			},
			[
				`Bạn đang yêu cầu áp dụng phân công tự động cho ${tasks.length} task${project ? ` trong project "${project.title}"` : ""}:`,
				...tasks.map((task) => `- ${task.title}`),
			]
		);
	}
	const result = await TaskAssignmentService.assignAndApply(
		params?.task_ids || tasks.map((task) => normalizeId(task)),
		null,
		{ maxParallelAssignees: 2 }
	);
	const lines = result.assignments.map((assignment) => {
		const names = assignment.assigned_users.map((u) => u.name).join(", ") || "chưa có người";
		return `- ${assignment.task.title}: ${names}`;
	});
	return [`Đã áp dụng phân công cho ${result.assignments.length} task:`, ...lines].join("\n");
}

async function reassignProjectTool({ user, params, message, confirmed = false }) {
	if (!canManage(user)) return "Role hiện tại chỉ có quyền xem, không thể phân công lại project.";
	const { project } = await resolveProject({
		user,
		projectId: params?.project_id,
		projectName: params?.project_name,
		message,
	});
	if (!project) return "Mình chưa tìm thấy project cần phân công lại. Hãy nói rõ tên project.";
	if (!confirmed) {
		return askConfirmation(
			user,
			{
				type: "confirm_reassign_project",
				params: { project_id: normalizeId(project) },
			},
			[`Bạn đang yêu cầu phân công lại toàn bộ task đang mở trong project "${project.title}".`]
		);
	}
	const result = await TaskAssignmentService.reassignByProject(project._id.toString(), {
		maxParallelAssignees: 2,
	});
	const lines = (result.assignments || []).map((assignment) => {
		const names = assignment.assigned_users.map((u) => u.name).join(", ") || "chưa có người";
		return `- ${assignment.task.title}: ${names}`;
	});
	return [`Đã phân công lại project "${project.title}" cho ${lines.length} task:`, ...lines].join("\n");
}

async function handlePendingSelection({ user, message }) {
	const pending = getPendingSelection(user);
	if (!pending) return null;

	const normalized = normalizeText(message);
	if (["huy", "cancel", "bo qua", "thoi"].includes(normalized)) {
		clearPendingSelection(user);
		return "Mình đã hủy lựa chọn đang chờ.";
	}

	if (pending.type?.startsWith("confirm_")) {
		if (!isConfirmationMessage(message)) {
			if (shouldReplacePendingSelection(message)) {
				clearPendingSelection(user);
				return null;
			}
			return "Mình đang chờ bạn xác nhận thao tác này. Gửi `xác nhận` để tiếp tục hoặc `hủy` để bỏ qua.";
		}
		clearPendingSelection(user);
		if (pending.type === "confirm_delete_task") {
			return deleteTaskTool({ user, params: pending.params || {}, message: "", confirmed: true });
		}
		if (pending.type === "confirm_delete_project") {
			return deleteProjectTool({ user, params: pending.params || {}, message: "", confirmed: true });
		}
		if (pending.type === "confirm_apply_assignment") {
			return applyAssignmentTool({ user, params: pending.params || {}, message: "", confirmed: true });
		}
		if (pending.type === "confirm_reassign_project") {
			return reassignProjectTool({ user, params: pending.params || {}, message: "", confirmed: true });
		}
		if (pending.type === "confirm_create_task_with_assignee") {
			return createTaskTool({ user, params: pending.params || {}, message: "" });
		}
	}

	if (pending.type === "create_task_assignee" && isAutoSuggestMessage(message)) {
		const suggestions = await chooseSuggestedAssigneesForPendingTask(pending, 3);
		if (suggestions.length === 0) {
			return "M?nh ch?a ?? d? li?u ?? t? ?? xu?t ng??i l?m. B?n ch?n gi?p m?nh b?ng s? trong danh s?ch ph?a tr?n nh?.";
		}
		setPendingSelection(user, {
			type: "create_task_assignee",
			params: pending.params || {},
			choices: suggestions.map((item) => ({
				id: item.user._id.toString(),
				label: item.user.name || item.user.email || item.user._id.toString(),
			})),
		});
		const lines = [
			`\u004d\u00ec\u006e\u0068 \u0111\u1ec1 \u0078\u0075\u1ea5\u0074 ${suggestions.length} \u006e\u0067\u01b0\u1eddi \u0070\u0068\u00f9 \u0068\u1ee3\u0070 \u006e\u0068\u1ea5\u0074. \u0042\u1ea1\u006e \u0063\u0068\u1ecd\u006e \u0073\u1ed1 \u0111\u1ec3 \u0067\u0069\u0061\u006f \u0074\u0061\u0073\u006b:`,
			...suggestions.map((item, index) => {
				const member = item.user;
				const skills = (member.skills || []).map((skill) => skill.name).filter(Boolean).slice(0, 3).join(", ");
				return `${index + 1}. ${member.name || member.email} - \u0074\u1ed5\u006e\u0067 ${formatScorePercent(item.adjustedScore)}, \u006b\u1ef9 \u006e\u0103\u006e\u0067 ${formatScorePercent(item.skillScore)}, \u006b\u0068\u1ea3 \u0064\u1ee5\u006e\u0067 ${formatScorePercent(item.mcmfScore)}, \u0111\u0061\u006e\u0067 \u0063\u00f3 ${member.current_task_count || 0} task${skills ? `, skill: ${skills}` : ""}`;
			}),
			"",
			"\u0043\u00e1\u0063\u0068 \u0074\u00ed\u006e\u0068 \u006e\u0068\u0061\u006e\u0068: \u0074\u1ed5\u006e\u0067 \u0111\u0069\u1ec3\u006d \u01b0\u0075 \u0074\u0069\u00ea\u006e \u0111\u1ed9 \u006b\u0068\u1edb\u0070 \u006b\u1ef9 \u006e\u0103\u006e\u0067 \u0076\u00e0 \u0111\u1ed9 \u006b\u0068\u1ea3 \u0064\u1ee5\u006e\u0067/\u0074\u1ea3\u0069 \u0076\u0069\u1ec7\u0063. \u0047\u1eedi `1`, `2` \u0068\u006f\u1eb7\u0063 `3` \u0111\u1ec3 \u0063\u0068\u1ecd\u006e; \u0067\u1eedi `\u0068\u1ee7\u0079` \u0111\u1ec3 \u0062\u1ecf \u0071\u0075\u0061.",
		];
		return lines.join("\n");
	}

	const selectedNumber = parseNumberSelection(message);
	if (!selectedNumber) {
		if (shouldReplacePendingSelection(message)) {
			clearPendingSelection(user);
			return null;
		}
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

	if (pending.type === "update_project_project") {
		clearPendingSelection(user);
		return updateProjectTool({
			user,
			params: {
				...(pending.params || {}),
				project_id: choice.id,
			},
			message: "",
		});
	}

	if (pending.type === "create_project_team") {
		return createProjectTool({
			user,
			params: {
				...(pending.params || {}),
				team_id: choice.id,
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
		case "update_task":
			return updateTaskTool({ user, params: intent.params || {}, message });
		case "delete_task":
			return deleteTaskTool({ user, params: intent.params || {}, message });
		case "mark_task_done":
			return markTaskDoneTool({ user, params: intent.params || {}, message });
		case "add_task_note":
			return addTaskNoteTool({ user, params: intent.params || {}, message });
		case "create_project":
			return createProjectTool({ user, params: intent.params || {}, message });
		case "update_project":
			return updateProjectTool({ user, params: intent.params || {}, message });
		case "delete_project":
			return deleteProjectTool({ user, params: intent.params || {}, message });
		case "list_teams":
			return listTeamsTool({ user, params: intent.params || {}, message });
		case "list_users":
			return listUsersTool({ user, params: intent.params || {}, message });
		case "list_skills":
			return listSkillsTool({ user, params: intent.params || {}, message });
		case "create_skill":
			return createSkillTool({ user, params: intent.params || {}, message });
		case "list_project_members":
			return listProjectMembersTool({ user, params: intent.params || {}, message });
		case "preview_assignment":
			return previewAssignmentTool({ user, params: intent.params || {}, message });
		case "apply_assignment":
			return applyAssignmentTool({ user, params: intent.params || {}, message });
		case "reassign_project":
			return reassignProjectTool({ user, params: intent.params || {}, message });
		case "daily_report":
			return dailyReportTool({ user, params: intent.params || {}, message });
		case "overdue_report":
			return overdueReportTool({ user, params: intent.params || {}, message });
		case "personnel_stats":
			return personnelStatsTool({ user, params: intent.params || {}, message });
		case "personal_report":
			return personalReportTool({ user, params: intent.params || {}, message });
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

		const { provider, modelName, model } = getAIModel();
		const intent = await classifyIntent(model, message, req.user?.role);
		const toolResponse = await executeTool({ intent, user: req.user, message });

		if (toolResponse) {
			return res.json({
				success: true,
				response: toolResponse,
				provider,
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
			provider,
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
