const Skill = require("../models/skill.model");

const listSkills = async (req, res) => {
	try {
		const pageRaw = parseInt(req.query.page, 10);
		const limitRaw = parseInt(req.query.limit, 10);
		const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
		const limit = Number.isNaN(limitRaw) ? 10 : Math.max(limitRaw, 0);
		const skip = limit > 0 ? (page - 1) * limit : 0;
		const skills = await Skill.find()
			.sort({ name: 1 })
			.limit(limit)
			.skip(skip);
		res.json(skills);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const createSkill = async (req, res) => {
	try {
		const { name, description = "" } = req.body;
		if (!name || !name.trim()) {
			return res.status(400).json({ error: "Skill name is required" });
		}
		const existing = await Skill.findOne({ name: name.trim() });
		if (existing) {
			return res.status(400).json({ error: "Skill already exists" });
		}
		const skill = await Skill.create({ name: name.trim(), description: description.trim() });
		res.status(201).json(skill);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const updateSkill = async (req, res) => {
	try {
		const { name, description = "" } = req.body;
		const updates = {};
		if (name !== undefined) updates.name = name.trim();
		if (description !== undefined) updates.description = description.trim();
		const updated = await Skill.findByIdAndUpdate(req.params.id, updates, { new: true });
		if (!updated) {
			return res.status(404).json({ error: "Skill not found" });
		}
		res.json(updated);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const deleteSkill = async (req, res) => {
	try {
		const deleted = await Skill.findByIdAndDelete(req.params.id);
		if (!deleted) {
			return res.status(404).json({ error: "Skill not found" });
		}
		res.json({ message: "Skill deleted" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

module.exports = { listSkills, createSkill, updateSkill, deleteSkill };