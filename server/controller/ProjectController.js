const mongoose = require("mongoose");
const Project = require("../models/project.model");
const Team = require("../models/team.model");
const Task = require("../models/task.model");
const StageTemplate = require("../models/stageTemplate.model");
const Contact = require("../models/contact.model");

function normalizeIdList(value) {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value : String(value).split(",");
  return raw
    .map((item) => {
      if (item && typeof item === "object") {
        return String(item._id || item.id || "").trim();
      }
      return String(item || "").trim();
    })
    .filter(Boolean);
}

function toObjectIds(ids) {
  return ids.map((id) => new mongoose.Types.ObjectId(id));
}

function normalizeObjectIdList(value) {
  return dedupeIds(normalizeIdList(value)).filter((id) => mongoose.Types.ObjectId.isValid(id));
}

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

function dedupeIds(values) {
  return [...new Set(values.map((value) => String(value)).filter(Boolean))];
}

function normalizeProjectCustomer(body = {}, currentProject = null) {
  if (
    body.customer === undefined &&
    body.customer_name === undefined &&
    body.customerName === undefined &&
    body.customer_code === undefined &&
    body.customerCode === undefined &&
    body.customer_description === undefined &&
    body.customerDescription === undefined
  ) {
    return Project.normalizeCustomer(currentProject?.customer || null);
  }

  const source =
    body.customer !== undefined
      ? body.customer
      : {
          name: body.customer_name ?? body.customerName ?? currentProject?.customer?.name ?? "",
          code: body.customer_code ?? body.customerCode ?? currentProject?.customer?.code ?? "",
          description:
            body.customer_description ??
            body.customerDescription ??
            currentProject?.customer?.description ??
            "",
        };

  return Project.normalizeCustomer(source);
}

function normalizeProjectContactIds(body = {}, currentProject = null) {
  if (
    body.contacts === undefined &&
    body.contactIds === undefined &&
    body.contact_ids === undefined &&
    body.primary_contact === undefined &&
    body.primaryContact === undefined
  ) {
    return {
      contactIds: normalizeObjectIdList(currentProject?.contacts || []),
      primaryContactId: currentProject?.primary_contact ? String(currentProject.primary_contact) : null,
    };
  }

  const contactIds = normalizeObjectIdList(body.contacts ?? body.contactIds ?? body.contact_ids ?? []);
  const primaryRaw = body.primary_contact ?? body.primaryContact ?? currentProject?.primary_contact ?? null;
  const primaryContactId = primaryRaw && mongoose.Types.ObjectId.isValid(String(primaryRaw)) ? String(primaryRaw) : null;

  if (primaryContactId && !contactIds.includes(primaryContactId)) {
    contactIds.unshift(primaryContactId);
  }

  return { contactIds, primaryContactId };
}

async function enrichProjectTeams(project) {
  const teamIds = dedupeIds(getProjectTeamIds(project));
  if (teamIds.length === 0) {
    return {
      teamIds: [],
      teams: [],
      members: [],
    };
  }

  const teams = await Team.find({ _id: { $in: toObjectIds(teamIds) } })
    .populate("members", "_id name email role skills")
    .lean();

  const orderedTeams = teamIds
    .map((teamId) => teams.find((team) => String(team._id) === teamId))
    .filter(Boolean)
    .map((team) => ({
      _id: team._id,
      name: team.name,
      members: (team.members || []).map((member) => ({
        _id: member._id,
        name: member.name || "",
        email: member.email || "",
        role: member.role || "",
        skills: Array.isArray(member.skills) ? member.skills : [],
      })),
    }));

  const memberMap = new Map();
  orderedTeams.forEach((team) => {
    (team.members || []).forEach((member) => {
      const memberId = String(member._id);
      if (!memberMap.has(memberId)) {
        memberMap.set(memberId, {
          ...member,
          team_ids: [],
        });
      }
      memberMap.get(memberId).team_ids.push(String(team._id));
    });
  });

  return {
    teamIds,
    teams: orderedTeams,
    members: Array.from(memberMap.values()),
  };
}

async function serializeProject(projectDoc) {
  const project = projectDoc?.toObject ? projectDoc.toObject() : { ...projectDoc };
  const enriched = await enrichProjectTeams(project);
  const primaryTeamId = enriched.teamIds[0] || (project.team ? String(project.team) : null);
  const projectContactIds = normalizeObjectIdList(project.contacts || []);
  const contacts = projectContactIds.length > 0
    ? await Contact.find({ _id: { $in: toObjectIds(projectContactIds) } }).sort({ name: 1 }).lean()
    : [];
  const orderedContacts = projectContactIds
    .map((contactId) => contacts.find((contact) => String(contact._id) === String(contactId)))
    .filter(Boolean);
  const primaryContactId = project.primary_contact ? String(project.primary_contact) : null;
  const customer = Project.normalizeCustomer(project.customer || null);

  return {
    ...project,
    team: primaryTeamId,
    teams: enriched.teamIds,
    team_ids: enriched.teamIds,
    teams_detail: enriched.teams,
    members: enriched.members,
    member_count: enriched.members.length,
    customer,
    customer_name: customer.name,
    contact_ids: projectContactIds,
    contacts: projectContactIds,
    contacts_detail: orderedContacts,
    primary_contact: primaryContactId,
    primary_contact_detail: orderedContacts.find((contact) => String(contact._id) === primaryContactId) || null,
  };
}

async function getUserTeamIds(userId) {
  const teams = await Team.find({
    members: { $elemMatch: { $eq: userId } },
  }).select("_id");
  return teams.map((team) => team._id.toString());
}

function projectHasAccess(project, teamIds) {
  return getProjectTeamIds(project).some((teamId) => teamIds.includes(teamId));
}

async function resolveProjectStages(body, currentProject = null) {
  const explicitStages = body.stages !== undefined ? Project.normalizeStages(body.stages) : null;
  const stageTemplateId = body.stageTemplateId || body.stage_template_id || null;

  if (explicitStages && explicitStages.length > 0) {
    return {
      stages: explicitStages,
      stageTemplateId: stageTemplateId || currentProject?.stage_template_id || null,
    };
  }

  if (stageTemplateId) {
    const template = await StageTemplate.findById(stageTemplateId);
    if (!template) {
      throw new Error("Stage template not found");
    }
    return {
      stages: Project.normalizeStages(template.stages),
      stageTemplateId: template._id,
    };
  }

  if (currentProject?.stages?.length) {
    return {
      stages: Project.normalizeStages(currentProject.stages),
      stageTemplateId: currentProject.stage_template_id || null,
    };
  }

  return {
    stages: Project.normalizeStages(Project.DEFAULT_STAGES),
    stageTemplateId: null,
  };
}

async function assertContactsExist(contactIds) {
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return;
  }
  const count = await Contact.countDocuments({ _id: { $in: toObjectIds(contactIds) } });
  if (count !== contactIds.length) {
    throw new Error("One or more contacts were not found");
  }
}

async function addProject(req, res) {
  try {
    if (req.user.role === "employee") {
      return res.status(403).json({ error: "Employees cannot create projects" });
    }

    const projectTeamIds = normalizeIdList(req.body.teams || req.body.team);
    if (projectTeamIds.length === 0) {
      return res.status(400).json({ error: "Project must have at least one team" });
    }

    if (req.user.role === "manager") {
      const userTeamIds = await getUserTeamIds(req.user.id);
      const hasInvalidTeam = projectTeamIds.some((teamId) => !userTeamIds.includes(teamId));
      if (hasInvalidTeam) {
        return res.status(403).json({ error: "You can only create projects with your own team(s)" });
      }
    }

    const { stages, stageTemplateId } = await resolveProjectStages(req.body);
    const customer = normalizeProjectCustomer(req.body);
    const { contactIds, primaryContactId } = normalizeProjectContactIds(req.body);
    await assertContactsExist(contactIds);
    const project = new Project({
      title: req.body.title,
      description: req.body.description,
      due_date: req.body.due_date,
      status: req.body.status || "in progress",
      team: new mongoose.Types.ObjectId(projectTeamIds[0]),
      teams: toObjectIds(projectTeamIds),
      stages,
      stage_template_id: stageTemplateId,
      customer,
      contacts: toObjectIds(contactIds),
      primary_contact: primaryContactId ? new mongoose.Types.ObjectId(primaryContactId) : null,
    });

    await project.save();
    res.status(201).json(await serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function getProjects(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  try {
    if (req.user.role === "admin") {
      const projects = await Project.find().limit(limit).skip(limit * (page - 1));
      return res.json(await Promise.all(projects.map(serializeProject)));
    }

    const teamIds = await getUserTeamIds(req.user.id);
    const projects = await Project.find({ teams: { $in: teamIds } })
      .limit(limit)
      .skip(limit * (page - 1));
    return res.json(await Promise.all(projects.map(serializeProject)));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function getProjectById(req, res) {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (req.user.role !== "admin") {
      const teamIds = await getUserTeamIds(req.user.id);
      if (!projectHasAccess(project, teamIds)) {
        return res.status(404).json({ error: "Project not found" });
      }
    }

    res.json(await serializeProject(project));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateProject(req, res) {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (req.user.role === "employee") {
      return res.status(403).json({ error: "Employees have read-only access and cannot update projects" });
    }

    if (req.user.role === "manager") {
      const teamIds = await getUserTeamIds(req.user.id);
      if (!projectHasAccess(project, teamIds)) {
        return res.status(403).json({ error: "You can only update projects in your team(s)" });
      }
    }

    const updates = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.due_date !== undefined) updates.due_date = req.body.due_date;
    if (req.body.status !== undefined) updates.status = req.body.status;
    updates.customer = normalizeProjectCustomer(req.body, project);

    const nextTeamIds = normalizeIdList(req.body.teams || req.body.team);
    if (req.body.teams !== undefined || req.body.team !== undefined) {
      if (nextTeamIds.length === 0) {
        return res.status(400).json({ error: "Project must have at least one team" });
      }
      updates.team = new mongoose.Types.ObjectId(nextTeamIds[0]);
      updates.teams = toObjectIds(nextTeamIds);
    }

    if (req.body.stages !== undefined || req.body.stageTemplateId !== undefined || req.body.stage_template_id !== undefined) {
      const { stages, stageTemplateId } = await resolveProjectStages(req.body, project);
      updates.stages = stages;
      updates.stage_template_id = stageTemplateId;
    }

    const { contactIds, primaryContactId } = normalizeProjectContactIds(req.body, project);
    await assertContactsExist(contactIds);
    updates.contacts = toObjectIds(contactIds);
    updates.primary_contact = primaryContactId ? new mongoose.Types.ObjectId(primaryContactId) : null;

    const updatedProject = await Project.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    res.json(await serializeProject(updatedProject));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function deleteProject(req, res) {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (req.user.role === "employee") {
      return res.status(403).json({ error: "Employees cannot delete projects" });
    }

    if (req.user.role === "manager") {
      const teamIds = await getUserTeamIds(req.user.id);
      if (!projectHasAccess(project, teamIds)) {
        return res.status(403).json({ error: "You can only delete projects in your team(s)" });
      }
    }

    await Project.findByIdAndDelete(req.params.id);
    await Task.deleteMany({ project: project._id });
    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function findProject(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 3;
  const search = String(req.query.search || "");

  try {
    const criteria = {
      $or: [
        { title: { $regex: search, $options: "i" } },
        { "customer.name": { $regex: search, $options: "i" } },
      ],
    };

    if (req.user.role !== "admin") {
      const teamIds = await getUserTeamIds(req.user.id);
      criteria.teams = { $in: teamIds };
    }

    const projects = await Project.find(criteria)
      .limit(limit)
      .skip(limit * (page - 1));
    res.json(await Promise.all(projects.map(serializeProject)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getAllProjects(req, res) {
  try {
    const projects = await Project.find();
    res.json(await Promise.all(projects.map(serializeProject)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getProjectByName(req, res) {
  try {
    const project = await Project.findOne({ title: req.params.title });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(await serializeProject(project));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  addProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  findProject,
  getAllProjects,
  getProjectByName,
};
