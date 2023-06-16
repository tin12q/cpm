const mongoose = require('mongoose');
const Team = require('../models/team.model');
const Task = require('../models/task.model');
const Project = require('../models/project.model');
const createTask = async (req, res) => {
    try {
        const task = new Task({
            title: req.body.title,
            description: req.body.description,
            due_date: req.body.due_date,
            status: req.body.status,
            project: new mongoose.Types.ObjectId(req.body.project),
            assigned_to: req.body.assigned_to.map((id) => new mongoose.Types.ObjectId(id)),
        });
        await task.save();
        res.status(201).json(task);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getTasks = async (req, res) => {
    //param for pagination
    const { page = 1, limit = 10 } = req.query;
    try {
        if (req.user.role == 'admin') {
            const tasks = await Task.find().limit(limit).skip(limit * (page - 1));
            res.json(tasks);
        } else {
            //return tasks if user in the same project of task
            const teams = await Team.find({ members: { $elemMatch: { $eq: req.user.id } } });
            const teamIds = teams.map((team) => team._id);
            const projects = await Project.find({ team: { $in: teamIds } });
            const projectIds = projects.map((project) => project._id);
            const tasks = await Task.find({ project: { $in: projectIds } }).limit(limit).skip(limit * (page - 1));
            res.json(tasks);
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const getTasksByProjectId = async (req, res) => {
    const { page = 1, limit = 8 } = req.query;
    try {
        const tasks = await Task.find({ project: new mongoose.Types.ObjectId(req.params.id) }).limit(limit).skip(limit * (page - 1));
        if (!tasks) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const getTaskByUserId = async (req, res) => {
    // search by current month, previous month, next month
    const { month = 1 } = req.query;
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth() - month, 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + month + 1, 0);
    try {
        if (req.user.role == 'admin') {
            // due_date is in current month, previous month, next month
            const tasks = await Task.find({
                due_date: {
                    $gte: startOfMonth,
                    $lte: endOfMonth,
                },
            });
            if (!tasks) {
                return res.status(404).json({ error: 'Task not found' });
            }
            return res.json(tasks);
        }
        const tasks = await Task.find({
            assigned_to: { $elemMatch: { $eq: userId } },
            due_date: {
                $gte: startOfMonth,
                $lte: endOfMonth,
            },
        });
        if (!tasks) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const findByName = async (req, res) => {
    const { page = 1, limit = 8 } = req.query;
    const { name } = req.query;
    const { project = null } = req.query;
    try {
        if (project === null) {
            const tasks = await Task.find({ title: { $regex: name, $options: 'i' } }).limit(limit).skip(limit * (page - 1));
            if (!tasks) {
                return res.status(404).json({ error: 'Task not found' });
            }
            res.json(tasks);
        }
        else {
            const tasks = await Task.find({ title: { $regex: name, $options: 'i' }, project: new mongoose.Types.ObjectId(project) }).limit(limit).skip(limit * (page - 1));
            if (!tasks) {
                return res.status(404).json({ error: 'Task not found' });
            }
            res.json(tasks);
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
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
const completedPercentage = async (req, res) => {
    try {
        const tasks = await Task.find({ project: new mongoose.Types.ObjectId(req.params.id) });
        if (!tasks) {
            return res.status(404).json({ error: 'Task not found' });
        }
        let completed = 0;
        tasks.forEach(task => {
            if (task.status == 'completed') {
                completed++;
            }
        });
        if (tasks.length == 0) {
            return res.json({ completed: 0 });
        }
        const percentage = (completed / tasks.length) * 100;
        res.json({ completed: percentage.toPrecision(3) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const latePercentage = async (req, res) => {
    try {
        const tasks = await Task.find({ project: new mongoose.Types.ObjectId(req.params.id) });
        if (!tasks) {
            return res.status(404).json({ error: 'Task not found' });
        }
        let lated = 0;
        tasks.forEach(task => {
            if (((new Date().getTime() - task.due_date > 0) && task.status != 'completed') || task.status == 'late') {
                lated++;
            }
        });
        if (tasks.length == 0) {
            return res.json({ lated: 0 });
        }
        const percentage = (lated / tasks.length) * 100;
        res.json({ lated: percentage.toPrecision(3) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const doneCheck = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (req.user.role === 'employee') {
            if (!task.assigned_to.includes(req.user.id)) {
                return res.status(401).json({ error: 'You are not assigned to this task' });
            }
        }
        if (task.status == 'completed') {
            return res.json({ message: 'Task is already completed' });
        }
        const isDone = req.body.isDone;
        if (isDone) {
            if (task.due_date - new Date().getTime() < 0) {
                const updatedTask = await Task.findByIdAndUpdate(req.params.id, { status: 'late' }, { new: true });
                return res.json(updatedTask);
            }
            const updatedTask = await Task.findByIdAndUpdate(req.params.id, { status: 'completed' }, { new: true });
            return res.json(updatedTask);
        }
        const updatedTask = await Task.findByIdAndUpdate(req.params.id, { status: 'completed' }, { new: true });
        res.json(updatedTask);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const completionByTeam = async (req, res) => {
    try {
        const team = await Team.find();
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const teamIds = team.map(t => t._id);

        let response = await Project.aggregate([
            {
                $match: {
                    team: { $in: teamIds }
                }
            },
            {
                $lookup: {
                    from: 'tasks',
                    localField: '_id',
                    foreignField: 'project',
                    as: 'tasks'
                }
            },
            {
                $group: {
                    _id: '$team',
                    projects: {
                        $push: {
                            project: '$_id',
                            completed: {
                                $size: {
                                    $filter: {
                                        input: '$tasks',
                                        as: 'task',
                                        cond: { $eq: ['$$task.status', 'completed'] }
                                    }
                                }
                            },
                            late: {
                                $size: {
                                    $filter: {
                                        input: '$tasks',
                                        as: 'task',
                                        cond: { $eq: ['$$task.status', 'late'] }
                                    }
                                }
                            },
                            in_progress: {
                                $size: {
                                    $filter: {
                                        input: '$tasks',
                                        as: 'task',
                                        cond: { $eq: ['$$task.status', 'in progress'] }
                                    }
                                }
                            },
                            total: { $size: '$tasks' }
                        }
                    }
                }
            },
            {
                $project: {
                    team: '$_id',
                    projects: 1,
                    _id: 0,
                    completed: { $sum: '$projects.completed' },
                    late: { $sum: '$projects.late' },
                    in_progress: { $sum: '$projects.in_progress' },
                    total: { $sum: '$projects.total' },
                }
            }
        ]);

        if (!response) {
            return res.status(404).json({ error: 'No data found' });
        }
        for (let i = 0; i < response.length; i++) {
            const team = await Team.findOne({ _id: new mongoose.Types.ObjectId(response[i].team) });
            if (!team) {
                return res.status(404).json({ error: 'Team not found' });
            }
            response[i].team = team.name;
        }
        res.json(response);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
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
    findByName
};