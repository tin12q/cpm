const mongoose = require("mongoose");
const Project = require("../models/project.model");
const Team = require("../models/team.model");
const Task = require("../models/task.model");
const jwt = require("jsonwebtoken");

const addProject = async (req, res) => {
	try {
		// Employees cannot create projects
		if (req.user.role === "employee") {
			return res
				.status(403)
				.json({ error: "Employees cannot create projects" });
		}

		// Handle teams - convert to array if needed
		let projectTeams = [];
		if (req.body.teams) {
			projectTeams = Array.isArray(req.body.teams)
				? req.body.teams
				: req.body.teams.split(",");
		} else if (req.body.team) {
			// Support legacy single team field
			projectTeams = [req.body.team];
		}

		// Validation: Must have at least 1 team
		if (!projectTeams || projectTeams.length === 0) {
			return res
				.status(400)
				.json({ error: "Project must have at least one team" });
		}

		// Managers can only create projects with their own team(s)
		if (req.user.role === "manager") {
			const userTeams = await Team.find({
				members: { $elemMatch: { $eq: req.user.id } },
			});
			const userTeamIds = userTeams.map((team) => team._id.toString());
			const hasInvalidTeam = projectTeams.some(
				(teamId) => !userTeamIds.includes(teamId.toString())
			);
			if (hasInvalidTeam) {
				return res
					.status(403)
					.json({
						error: "You can only create projects with your own team(s)",
					});
			}
		}

		const project = new Project({
			title: req.body.title,
			description: req.body.description,
			due_date: req.body.due_date,
			status: req.body.status,
			teams: projectTeams.map((id) => new mongoose.Types.ObjectId(id)),
		});
		await project.save();
		res.status(201).json(project);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
};

const getProjects = async (req, res) => {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 10;
	try {
		if (req.user.role == "admin") {
			const projects = await Project.find()
				.limit(limit)
				.skip(limit * (page - 1));
			return res.json(projects);
		} else {
			const teams = await Team.find({
				members: { $elemMatch: { $eq: req.user.id } },
			});
			const teamIds = teams.map((team) => team._id);
			const projects = await Project.find({ teams: { $in: teamIds } })
				.limit(limit)
				.skip(limit * (page - 1));
			return res.json(projects);
		}
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

const getProjectById = async (req, res) => {
	try {
		const project = await Project.findById(req.params.id);
		if (!project) {
			return res.status(404).json({ error: "Project not found" });
		}
		if (req.user.role != "admin") {
			const teams = await Team.find({
				members: { $elemMatch: { $eq: req.user.id } },
			});
			const teamIds = teams.map((team) => team._id);
			const projects = await Project.find({ teams: { $in: teamIds } });
			const projectExists = projects.some((p) => p._id.equals(project._id));
			if (!projectExists) {
				return res.status(404).json({ error: "Project not found" });
			}
		}
		res.json(project);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const updateProject = async (req, res) => {
	try {
		const project = await Project.findById(req.params.id);
		if (!project) {
			return res.status(404).json({ error: "Project not found" });
		}

		// Employees have read-only access
		if (req.user.role === "employee") {
			return res.status(403).json({
				error: "Employees have read-only access and cannot update projects",
			});
		}

		if (req.user.role === "manager") {
			const teams = await Team.find({
				members: { $elemMatch: { $eq: req.user.id } },
			});
			const teamIds = teams.map((team) => team._id.toString());
			const hasAccess = project.teams.some((teamId) =>
				teamIds.includes(teamId.toString())
			);
			if (!hasAccess) {
				return res
					.status(403)
					.json({ error: "You can only update projects in your team(s)" });
			}
		}

		// Handle teams update with validation
		if (req.body.teams) {
			let projectTeams = Array.isArray(req.body.teams)
				? req.body.teams
				: req.body.teams.split(",");
			if (projectTeams.length === 0) {
				return res
					.status(400)
					.json({ error: "Project must have at least one team" });
			}
			req.body.teams = projectTeams.map(
				(id) => new mongoose.Types.ObjectId(id)
			);
		} else if (req.body.team) {
			// Support legacy single team field
			req.body.teams = [new mongoose.Types.ObjectId(req.body.team)];
			delete req.body.team;
		}

		const updatedProject = await Project.findByIdAndUpdate(
			req.params.id,
			req.body,
			{
				new: true,
			}
		);
		res.json(updatedProject);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const deleteProject = async (req, res) => {
	try {
		const project = await Project.findById(req.params.id);
		if (!project) {
			return res.status(404).json({ error: "Project not found" });
		}

		// Only admin can delete, or manager of the same team
		if (req.user.role === "employee") {
			return res
				.status(403)
				.json({ error: "Employees cannot delete projects" });
		}

		if (req.user.role === "manager") {
			const teams = await Team.find({
				members: { $elemMatch: { $eq: req.user.id } },
			});
			const teamIds = teams.map((team) => team._id.toString());
			const hasAccess = project.teams.some((teamId) =>
				teamIds.includes(teamId.toString())
			);
			if (!hasAccess) {
				return res
					.status(403)
					.json({ error: "You can only delete projects in your team(s)" });
			}
		}

		await Project.findByIdAndDelete(req.params.id);
		res.json({ message: "Project deleted successfully" });
		//delete all tasks related to the project
		await Task.deleteMany({ project: project._id });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
const findProject = async (req, res) => {
	const { page = 1, limit = 3 } = req.query;
	const { search } = req.query;
	console.log(search);
	try {
		if (req.user.role === "admin") {
			const projects = await Project.find({
				title: { $regex: search, $options: "i" },
			})
				.limit(limit)
				.skip(limit * (page - 1));
			res.json(projects);
		} else {
			const teams = await Team.find({
				members: { $elemMatch: { $eq: req.user.id } },
			});
			const teamIds = teams.map((team) => team._id);
			const projects = await Project.find({
				team: { $in: teamIds },
				title: { $regex: search, $options: "i" },
			})
				.limit(limit)
				.skip(limit * (page - 1));
			res.json(projects);
		}
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const getAllProjects = async (req, res) => {
	try {
		const projects = await Project.find();
		res.json(projects);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const getProjectByName = async (req, res) => {
	try {
		const project = await Project.find({ title: req.params.title });
		if (!project) {
			return res.status(404).json({ error: "Project not found" });
		}
		res.json(project);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
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
