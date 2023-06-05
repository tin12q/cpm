const mongoose = require('mongoose');
const Project = require('../models/project.model');
const Team = require('../models/team.model');
const jwt = require('jsonwebtoken');

const addProject = async (req, res) => {
  try {
    const project = new Project(req.body);
    await project.save();
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getProjects = async (req, res) => {
  try {
    if (req.user.role == 'admin') {
      const projects = await Project.find();
      res.json(projects);
    }
    else {
      const teams = await Team.find({ members: { $elemMatch: { $eq: req.user.id } } });
      const teamIds = teams.map((team) => team._id);
      const projects = await Project.find({ team: { $in: teamIds } });
      res.json(projects);
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.idp);
    console.log(req.params.idp);
    console.log(req.user.role);
    console.log(project);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (req.user.role != 'admin') {
      const teams = await Team.find({ members: { $elemMatch: { $eq: req.user.id } } });
      const teamIds = teams.map((team) => team._id);
      const projects = await Project.find({ team: { $in: teamIds } });
      const projectExists = projects.some((p) => p._id.equals(project._id));
      if (!projectExists) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }
    res.json(project);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
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
};