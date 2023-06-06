const mongoose = require('mongoose');
const Team = require('../models/team.model');
const Task = require('../models/task.model');
const Project = require('../models/project.model');
const createTask = async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getTasks = async (req, res) => {
  try {
    if (req.user.role == 'admin') {
      const tasks = await Task.find();
      res.json(tasks);
    }
    else {
      //return tasks if user in the same project of task
      const teams = await Team.find({ members: { $elemMatch: { $eq: req.user.id } } });
      const teamIds = teams.map((team) => team._id);
      const projects = await Project.find({ team: { $in: teamIds } });
      const projectIds = projects.map((project) => project._id);
      const tasks = await Task.find({ project: { $in: projectIds } });
      res.json(tasks);
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const getTasksByProjectId = async (req, res) => {
  try {
    const tasks = await Task.find({ project: new mongoose.Types.ObjectId(req.params.id) });
    if (!tasks) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateTask = async (req, res) => {
  try {
    console.log(req.body);
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTasksByProjectId
};