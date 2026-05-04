const User = require("../models/user.model");
const Auth = require("../models/auth.model");
const Team = require("../models/team.model");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

function normalizeSkillPayload(skills) {
	if (!Array.isArray(skills)) return [];
	return skills
		.map((skill) => {
			if (typeof skill === "string") {
				return { name: skill.trim(), description: "" };
			}
			if (skill && typeof skill === "object") {
				return {
					name: (skill.name || "").trim(),
					description: (skill.description || "").trim(),
					_id: skill._id,
				};
			}
			return null;
		})
		.filter((skill) => skill && skill.name);
}

function sanitizeUserDoc(userDoc) {
	if (!userDoc) return null;
	const user = userDoc.toObject ? userDoc.toObject() : userDoc;
	user.skills = normalizeSkillPayload(user.skills || []);
	return user;
}

async function ensureCanManageUser(req, targetUserId) {
	if (req.user.role === "admin") return true;
	if (req.user.role === "manager") {
		const sharedTeam = await Team.findOne({
			members: {
				$all: [
					new mongoose.Types.ObjectId(req.user.id),
					new mongoose.Types.ObjectId(targetUserId),
				],
			},
		});
		return !!sharedTeam;
	}
	return false;
}
const getUser = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		res.json(sanitizeUserDoc(user));
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
const getUsers = async (req, res) => {
	const { page = 1, limit = 9 } = req.query;
	try {
		const users = await User.find()
			.limit(limit)
			.skip((page - 1) * limit);
		res.json(users.map((u) => sanitizeUserDoc(u)));
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
const getAllUsers = async (req, res) => {
	try {
		const users = await User.find();
		res.json(users.map((u) => sanitizeUserDoc(u)));
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const findByName = async (req, res) => {
	const { page = 1, limit = 9 } = req.query;
	const { search } = req.query;
	try {
		const users = await User.find({
			name: { $regex: search, $options: "i" },
		}).limit(limit);
		res.json(users.map((u) => sanitizeUserDoc(u)));
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
async function addUser(req, res) {
	try {
		const { name, dob, email, role, username, password, team } = req.body;
		const skills = normalizeSkillPayload(req.body.skills || []);
		const ifExists = await User.findOne({ username: username });
		if (ifExists) {
			return res.status(400).json({ error: "User already exists" });
		}
		const user = new User({ name, dob, email, role, skills });

		await user.save();
		//get the id of the user
		const id = new mongoose.Types.ObjectId(user._id);
		const hashedPassword = await bcrypt.hash(password, 10);
		const auth = new Auth({
			username,
			password: hashedPassword,
			role,
			user: id,
		});
		await auth.save();
		//add user id to team members
		const teamId = new mongoose.Types.ObjectId(team);
		await Team.updateOne({ _id: teamId }, { $push: { members: id } });

		res.status(201).json({ message: "User added successfully" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
}
const deleteUser = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		await User.deleteOne({ _id: req.params.id });
		const auth = await Auth.findOne({
			user: new mongoose.Types.ObjectId(req.params.id),
		});
		await Auth.deleteOne({ _id: auth._id });
		//delete from team
		const team = await Team.findOne({
			members: {
				$elemMatch: { $eq: new mongoose.Types.ObjectId(req.user.id) },
			},
		});
		if (team) {
			await Team.updateOne(
				{ _id: team._id },
				{ $pull: { members: new mongoose.Types.ObjectId(req.params.id) } }
			);
		}
		res.json({ message: "User deleted successfully" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const listSkills = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		res.json(normalizeSkillPayload(user.skills || []));
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const addSkill = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		const canManage = await ensureCanManageUser(req, req.params.id);
		if (!canManage) {
			return res.status(403).json({ error: "Unauthorized" });
		}
		const { name, description = "" } = req.body;
		if (!name || !name.trim()) {
			return res.status(400).json({ error: "Skill name is required" });
		}
		user.skills.push({ name: name.trim(), description: description.trim() });
		await user.save();
		res.status(201).json(normalizeSkillPayload(user.skills));
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const updateSkill = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		const canManage = await ensureCanManageUser(req, req.params.id);
		if (!canManage) {
			return res.status(403).json({ error: "Unauthorized" });
		}
		const skill = user.skills.id(req.params.skillId);
		if (!skill) {
			return res.status(404).json({ error: "Skill not found" });
		}
		skill.name = (req.body.name || skill.name || "").trim();
		skill.description = (req.body.description || "").trim();
		await user.save();
		res.json(normalizeSkillPayload(user.skills));
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const deleteSkill = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		const canManage = await ensureCanManageUser(req, req.params.id);
		if (!canManage) {
			return res.status(403).json({ error: "Unauthorized" });
		}
		const skill = user.skills.id(req.params.skillId);
		if (!skill) {
			return res.status(404).json({ error: "Skill not found" });
		}
		skill.deleteOne();
		await user.save();
		res.json(normalizeSkillPayload(user.skills));
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
const updateUser = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}
		const canManage = await ensureCanManageUser(req, req.params.id);
		if (!canManage) {
			return res
				.status(403)
				.json({ error: "You are not allowed to update this user" });
		}
		const { name, dob, email, role, username, password, team } = req.body;
		const skills = normalizeSkillPayload(req.body.skills || user.skills || []);
		const updates = {
			name: name ?? user.name,
			dob: dob ?? user.dob,
			email: email ?? user.email,
			role: role ?? user.role,
			skills,
		};
		await User.updateOne({ _id: req.params.id }, updates);
		if (team !== user.team && team !== null) {
			//delete from team
			const existingTeam = await Team.findOne({
				members: {
					$elemMatch: { $eq: new mongoose.Types.ObjectId(req.params.id) },
				},
			});
			if (existingTeam) {
				await Team.updateOne(
					{ _id: existingTeam._id },
					{ $pull: { members: new mongoose.Types.ObjectId(req.params.id) } }
				);
			}
			//add user id to team members
			const teamId = new mongoose.Types.ObjectId(team);
			await Team.updateOne(
				{ _id: teamId },
				{ $push: { members: req.params.id } }
			);
		}

		const authUpdate = { role: role ?? user.role };
		if (username) {
			authUpdate.username = username;
		}
		if (password) {
			authUpdate.password = await bcrypt.hash(password, 10);
		}
		await Auth.updateOne(
			{ user: new mongoose.Types.ObjectId(req.params.id) },
			authUpdate
		);
		res.json({ message: "User updated successfully" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
module.exports = {
	getUser,
	getUsers,
	getAllUsers,
	addUser,
	deleteUser,
	updateUser,
	findByName,
	listSkills,
	addSkill,
	updateSkill,
	deleteSkill,
};
