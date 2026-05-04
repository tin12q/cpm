const mongoose = require("mongoose");
const Team = require("../models/team.model");
const Task = require("../models/task.model");
const Project = require("../models/project.model");
const TaskNote = require("../models/taskNote.model");
const TaskAssignmentService = require("../services/TaskAssignmentService");

function getProjectTeamIds(project) {
  if (!project) {
    return [];
  }
  if (Array.isArray(project.teams) && project.teams.length > 0) {
    return project.teams.map((teamId) => teamId.toString());
  }
  if (project.team) {
    return [project.team.toString()];
  }
  return [];
}

async function getUserTeamIds(userId) {
  const teams = await Team.find({
    members: { $elemMatch: { $eq: userId } },
  }).select("_id");
  return teams.map((team) => team._id.toString());
}

function taskAssignedToUser(task, userId) {
  return (task.assigned_to || []).some((assignedId) => assignedId.toString() === String(userId));
}

async function ensureProjectAccess(user, project) {
  if (user.role === "admin") {
    return true;
  }
  const teamIds = await getUserTeamIds(user.id);
  return getProjectTeamIds(project).some((teamId) => teamIds.includes(teamId));
}

async function ensureTaskAccess(user, task) {
  const project = await Project.findById(task.project);
  if (!project) {
    return false;
  }
  return ensureProjectAccess(user, project);
}

function normalizeAssignedTo(value) {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value : String(value).split(",");
  return raw
    .map((item) => {
      if (item && typeof item === "object") {
        return String(item._id || item.value || item.id || item).trim();
      }
      return String(item || "").trim();
    })
    .filter(Boolean);
}

function normalizeMentions(value) {
  return normalizeAssignedTo(value).map((id) => new mongoose.Types.ObjectId(id));
}

function normalizeRequiredSkills(value) {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value : String(value).split(",");
  return [...new Set(raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") return String(item.name || item.label || item.value || "").trim();
      return "";
    })
    .filter(Boolean))];
}

function getProjectStages(project) {
  return Project.normalizeStages(project?.stages);
}

function getDefaultStageKey(project) {
  return getProjectStages(project)[0]?.key || "backlog";
}

function resolveStageValue(requestedStage, project) {
  const allowedStages = getProjectStages(project);
  if (!requestedStage) {
    return getDefaultStageKey(project);
  }

  const stageKey = String(requestedStage).trim();
  if (allowedStages.some((stage) => stage.key === stageKey)) {
    return stageKey;
  }

  throw new Error("Invalid stage for project");
}

async function getProjectMembers(project) {
  const teamIds = getProjectTeamIds(project);
  const teams = await Team.find({ _id: { $in: teamIds } }).select("members");
  return [...new Set(teams.flatMap((team) => (team.members || []).map((member) => member.toString())))];
}

async function getAccessibleProjects(user) {
  if (user.role === "admin") {
    return Project.find();
  }

  const teamIds = await getUserTeamIds(user.id);
  return Project.find({ teams: { $in: teamIds } });
}

function getTaskStageCounts(tasks, projects) {
  const stageMeta = new Map();
  (projects || []).forEach((project) => {
    (Project.normalizeStages(project.stages) || []).forEach((stage) => {
      if (!stageMeta.has(stage.key)) {
        stageMeta.set(stage.key, {
          key: stage.key,
          name: stage.name,
          color: stage.color,
          order: stage.order,
          count: 0,
        });
      }
    });
  });

  tasks.forEach((task) => {
    const stageKey = String(task.stage || "backlog");
    if (!stageMeta.has(stageKey)) {
      stageMeta.set(stageKey, {
        key: stageKey,
        name: stageKey,
        color: "slate",
        order: stageMeta.size,
        count: 0,
      });
    }
    stageMeta.get(stageKey).count += 1;
  });

  return Array.from(stageMeta.values()).sort((a, b) => a.order - b.order);
}

function getStatusCounts(tasks) {
  return tasks.reduce(
    (acc, task) => {
      const status = String(task.status || "in progress").toLowerCase();
      if (status === "completed") acc.completed += 1;
      else if (status === "late") acc.late += 1;
      else acc.in_progress += 1;
      return acc;
    },
    { completed: 0, late: 0, in_progress: 0 }
  );
}

async function createTask(req, res) {
  try {
    if (req.user.role === "employee") {
      return res.status(403).json({ error: "Employees cannot create tasks" });
    }

    const project = await Project.findById(req.body.project);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const canAccessProject = await ensureProjectAccess(req.user, project);
    if (!canAccessProject) {
      return res.status(403).json({ error: "You can only create tasks in your team's projects" });
    }

    const projectMembers = await getProjectMembers(project);
    const assignedTo = normalizeAssignedTo(req.body.assigned_to);
    const needsAutoAssignment = assignedTo.length === 0;
    const stage = resolveStageValue(req.body.stage, project);
    const requiredSkills = normalizeRequiredSkills(req.body.required_skills || req.body.skills_required);

    if (needsAutoAssignment) {
      const doc = {
        title: req.body.title,
        description: req.body.description,
        due_date: req.body.due_date,
        status: req.body.status || "in progress",
        stage,
        project: new mongoose.Types.ObjectId(req.body.project),
        assigned_to: [],
        difficulty: req.body.difficulty || 2,
        priority: req.body.priority || 3,
        can_parallelize: req.body.can_parallelize !== false,
        required_skills: requiredSkills,
        skills_required: requiredSkills,
      };

      const insertResult = await Task.collection.insertOne(doc);
      const taskId = insertResult.insertedId;

      try {
        const assignmentResult = await TaskAssignmentService.assignAndApply(
          [taskId.toString()],
          projectMembers.length > 0 ? projectMembers : null
        );

        const updatedTask = await Task.findById(taskId);
        return res.status(201).json({
          task: updatedTask,
          autoAssigned: true,
          assignmentDetails: assignmentResult.assignments[0] || null,
        });
      } catch (assignError) {
        await Task.findByIdAndDelete(taskId);
        return res.status(400).json({
          error: "Auto-assignment failed. Please assign employees manually.",
          details: assignError.message,
        });
      }
    }

    const task = new Task({
      title: req.body.title,
      description: req.body.description,
      due_date: req.body.due_date,
      status: req.body.status || "in progress",
      stage,
      project: new mongoose.Types.ObjectId(req.body.project),
      assigned_to: assignedTo.map((id) => new mongoose.Types.ObjectId(id)),
      difficulty: req.body.difficulty || 2,
      priority: req.body.priority || 3,
      can_parallelize: req.body.can_parallelize !== false,
      required_skills: requiredSkills,
      skills_required: requiredSkills,
    });
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function getTasks(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  try {
    if (req.user.role === "admin") {
      const tasks = await Task.find().limit(limit).skip(limit * (page - 1));
      return res.json(tasks);
    }

    const teamIds = await getUserTeamIds(req.user.id);
    const projects = await Project.find({ teams: { $in: teamIds } }).select("_id");
    const projectIds = projects.map((project) => project._id);
    const tasks = await Task.find({ project: { $in: projectIds } })
      .limit(limit)
      .skip(limit * (page - 1));
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getTasksByProjectId(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 8;
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const canAccessProject = await ensureProjectAccess(req.user, project);
    if (!canAccessProject) {
      return res.status(404).json({ error: "Project not found" });
    }

    const tasks = await Task.find({ project: project._id })
      .limit(limit)
      .skip(limit * (page - 1));
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getTaskByUserId(req, res) {
  const month = parseInt(req.query.month, 10) || 1;
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth() - month, 1).getTime();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + month + 1, 0).getTime();

  try {
    const criteria = {
      due_date: {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    };

    if (req.user.role !== "admin") {
      criteria.assigned_to = { $elemMatch: { $eq: userId } };
    }

    const tasks = await Task.find(criteria);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function findByName(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 8;
  const name = String(req.query.name || "");
  const project = req.query.project || null;

  try {
    const criteria = {
      title: { $regex: name, $options: "i" },
    };

    if (project) {
      criteria.project = new mongoose.Types.ObjectId(project);
    }

    const tasks = await Task.find(criteria)
      .limit(limit)
      .skip(limit * (page - 1));
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getTaskById(req, res) {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const canAccessTask = await ensureTaskAccess(req.user, task);
    if (!canAccessTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateTask(req, res) {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (req.user.role === "employee") {
      return res.status(403).json({ error: "Employees have read-only access and cannot update tasks" });
    }

    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const canAccessProject = await ensureProjectAccess(req.user, project);
    if (!canAccessProject) {
      return res.status(403).json({ error: "You can only update tasks in your team's projects" });
    }

    const updates = { ...req.body };
    if (req.body.assigned_to !== undefined) {
      updates.assigned_to = normalizeAssignedTo(req.body.assigned_to).map(
        (id) => new mongoose.Types.ObjectId(id)
      );
    }
    if (req.body.required_skills !== undefined || req.body.skills_required !== undefined) {
      const requiredSkills = normalizeRequiredSkills(req.body.required_skills || req.body.skills_required);
      updates.required_skills = requiredSkills;
      updates.skills_required = requiredSkills;
    }
    if (req.body.stage !== undefined) {
      updates.stage = resolveStageValue(req.body.stage, project);
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function deleteTask(req, res) {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (req.user.role === "employee") {
      return res.status(403).json({ error: "Employees cannot delete tasks" });
    }

    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const canAccessProject = await ensureProjectAccess(req.user, project);
    if (!canAccessProject) {
      return res.status(403).json({ error: "You can only delete tasks in your team's projects" });
    }

    await Task.findByIdAndDelete(req.params.id);
    await TaskNote.deleteMany({ task: task._id });
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function completedPercentage(req, res) {
  try {
    const tasks = await Task.find({ project: new mongoose.Types.ObjectId(req.params.id) });
    let completed = 0;
    tasks.forEach((task) => {
      if (task.status === "completed") {
        completed += 1;
      }
    });
    if (tasks.length === 0) {
      return res.json({ completed: 0 });
    }
    const percentage = (completed / tasks.length) * 100;
    res.json({ completed: percentage.toPrecision(3) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function latePercentage(req, res) {
  try {
    const tasks = await Task.find({ project: new mongoose.Types.ObjectId(req.params.id) });
    let lated = 0;
    tasks.forEach((task) => {
      if ((Date.now() - task.due_date > 0 && task.status !== "completed") || task.status === "late") {
        lated += 1;
      }
    });
    if (tasks.length === 0) {
      return res.json({ lated: 0 });
    }
    const percentage = (lated / tasks.length) * 100;
    res.json({ lated: percentage.toPrecision(3) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function doneCheck(req, res) {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (req.user.role === "employee" && !taskAssignedToUser(task, req.user.id)) {
      return res.status(401).json({ error: "You are not assigned to this task" });
    }
    if (task.status === "completed") {
      return res.json({ message: "Task is already completed" });
    }

    const isDone = req.body.isDone;
    const nextStatus = isDone && task.due_date - Date.now() < 0 ? "late" : "completed";
    const updatedTask = await Task.findByIdAndUpdate(req.params.id, { status: nextStatus }, { new: true });
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function completionByTeam(req, res) {
  try {
    const teams = await Team.find().select("_id name");
    const response = [];

    for (const team of teams) {
      const projects = await Project.find({ teams: team._id }).select("_id");
      const projectIds = projects.map((project) => project._id);
      const tasks = await Task.find({ project: { $in: projectIds } }).select("status");

      let completed = 0;
      let late = 0;
      let inProgress = 0;
      tasks.forEach((task) => {
        if (task.status === "completed") completed += 1;
        else if (task.status === "late") late += 1;
        else inProgress += 1;
      });

      response.push({
        team: team.name,
        completed,
        late,
        in_progress: inProgress,
        total: tasks.length,
      });
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getDashboardOverview(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 6, 50);
  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  try {
    const projects = await getAccessibleProjects(req.user);
    const projectIds = projects.map((project) => project._id);
    const tasks = await Task.find({ project: { $in: projectIds } }).lean();
    const overdueTasks = tasks
      .filter((task) => Number(task.due_date || 0) < now && task.status !== "completed")
      .sort((a, b) => Number(a.due_date || 0) - Number(b.due_date || 0));

    const pagedOverdueTasks = overdueTasks.slice(limit * (page - 1), limit * page);
    const overdueWithProject = pagedOverdueTasks.map((task) => {
      const project = projects.find((item) => String(item._id) === String(task.project));
      return {
        _id: task._id,
        title: task.title,
        due_date: task.due_date,
        status: task.status,
        stage: task.stage || "backlog",
        priority: task.priority || 3,
        project: project
          ? { _id: project._id, title: project.title, status: project.status }
          : { _id: task.project, title: "Unknown project", status: "" },
        assigned_count: Array.isArray(task.assigned_to) ? task.assigned_to.length : 0,
      };
    });

    const statusCounts = getStatusCounts(tasks);
    const stageCounts = getTaskStageCounts(tasks, projects);
    const dueToday = tasks.filter(
      (task) => Number(task.due_date || 0) >= now && Number(task.due_date || 0) <= endOfToday.getTime()
    ).length;
    const dueThisWeek = tasks.filter(
      (task) => Number(task.due_date || 0) >= now && Number(task.due_date || 0) <= endOfWeek.getTime()
    ).length;

    res.json({
      summary: {
        total_tasks: tasks.length,
        overdue_tasks: overdueTasks.length,
        due_today: dueToday,
        due_this_week: dueThisWeek,
        active_projects: projects.length,
        status_counts: statusCounts,
      },
      stage_counts: stageCounts,
      overdue: {
        page,
        limit,
        total: overdueTasks.length,
        items: overdueWithProject,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getAllTasks(req, res) {
  try {
    const tasks = await Task.find();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getTasksByNameMobile(req, res) {
  try {
    const tasks = await Task.find({
      title: { $regex: req.query.name, $options: "i" },
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getTaskNotes(req, res) {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const canAccessTask = await ensureTaskAccess(req.user, task);
    if (!canAccessTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    const notes = await TaskNote.find({ task: task._id })
      .sort({ createdAt: 1 })
      .populate("author", "name email role")
      .populate("mentions", "name email role");
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function addTaskNote(req, res) {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const canAccessTask = await ensureTaskAccess(req.user, task);
    if (!canAccessTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    const content = String(req.body.content || "").trim();
    if (!content) {
      return res.status(400).json({ error: "Note content is required" });
    }

    const note = await TaskNote.create({
      task: task._id,
      author: new mongoose.Types.ObjectId(req.user.id),
      content,
      mentions: normalizeMentions(req.body.mentions),
    });

    if (note.mentions.length > 0) {
      console.log("task-note-mentions", {
        taskId: task._id.toString(),
        noteId: note._id.toString(),
        mentions: note.mentions.map((mentionId) => mentionId.toString()),
      });
    }

    const populated = await TaskNote.findById(note._id)
      .populate("author", "name email role")
      .populate("mentions", "name email role");
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTasksByProjectId,
  getTaskByUserId,
  completedPercentage,
  latePercentage,
  doneCheck,
  completionByTeam,
  getDashboardOverview,
  findByName,
  getAllTasks,
  getTasksByNameMobile,
  getTaskNotes,
  addTaskNote,
};
