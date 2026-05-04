const StageTemplate = require("../models/stageTemplate.model");
const Project = require("../models/project.model");

function normalizeTemplatePayload(body = {}) {
  return {
    name: String(body.name || "").trim(),
    description: String(body.description || "").trim(),
    is_default: Boolean(body.is_default || body.isDefault || false),
    stages: Project.normalizeStages(body.stages),
  };
}

const listStageTemplates = async (req, res) => {
  try {
    const templates = await StageTemplate.find().sort({ createdAt: -1, name: 1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStageTemplateById = async (req, res) => {
  try {
    const template = await StageTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Stage template not found" });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createStageTemplate = async (req, res) => {
  try {
    const payload = normalizeTemplatePayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: "Template name is required" });
    }

    if (payload.is_default) {
      await StageTemplate.updateMany({}, { $set: { is_default: false } });
    }

    const created = await StageTemplate.create(payload);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateStageTemplate = async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) {
      updates.name = String(req.body.name || "").trim();
    }
    if (req.body.description !== undefined) {
      updates.description = String(req.body.description || "").trim();
    }
    if (req.body.is_default !== undefined || req.body.isDefault !== undefined) {
      updates.is_default = Boolean(req.body.is_default || req.body.isDefault);
    }
    if (req.body.stages !== undefined) {
      updates.stages = Project.normalizeStages(req.body.stages);
    }
    if (updates.is_default) {
      await StageTemplate.updateMany({ _id: { $ne: req.params.id } }, { $set: { is_default: false } });
    }

    const updated = await StageTemplate.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Stage template not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteStageTemplate = async (req, res) => {
  try {
    const deleted = await StageTemplate.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Stage template not found" });
    }
    await Project.updateMany({ stage_template_id: deleted._id }, { $set: { stage_template_id: null } });
    res.json({ message: "Stage template deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listStageTemplates,
  getStageTemplateById,
  createStageTemplate,
  updateStageTemplate,
  deleteStageTemplate,
};
