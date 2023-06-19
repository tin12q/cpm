const User = require('../models/user.model');
const Auth = require('../models/auth.model');
const Team = require('../models/team.model');
const Task = require('../models/task.model');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const getMe = async (req, res) => {
    try {
        //TODO: Add getMe
        const uid = req.user.id;
        const user = await Auth.aggregate([
            {
                $match: { user: new mongoose.Types.ObjectId(uid) }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'user'
                }
            }
        ]);
        const response = {
            name: user[0].user[0].name,
            email: user[0].user[0].email,
            dob: user[0].user[0].dob,
        };
        res.json(response);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const getUsers = async (req, res) => {
    const { page = 1, limit = 9 } = req.query;
    try {
        const users = await User.find().limit(limit).skip((page - 1) * limit);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const findByName = async (req, res) => {
    const { page = 1, limit = 9 } = req.query;
    const { search } = req.query;
    try {
        const users = await User.find({ name: { $regex: search, $options: 'i' } }).limit(limit);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function addUser(req, res) {
    try {
        const { name, dob, email, role, username, password, team } = req.body;
        const ifExists = await User.findOne({ username: username });
        if (ifExists) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const user = new User({ name, dob, email, role });

        await user.save();
        //get the id of the user
        const id = new mongoose.Types.ObjectId(user._id);
        const hashedPassword = await bcrypt.hash(password, 10);
        const auth = new Auth({ username, password: hashedPassword, role, user: id });
        await auth.save();
        //add user id to team members
        const teamId = new mongoose.Types.ObjectId(team);
        await Team.updateOne({ _id: teamId }, { $push: { members: id } });

        res.status(201).json({ message: 'User added successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        await User.deleteOne({ _id: req.params.id });
        const auth = await Auth.findOne({ user: new mongoose.Types.ObjectId(req.params.id) });
        await Auth.deleteOne({ _id: auth._id });
        //delete from team
        const team = await Team.findOne({ members: { $elemMatch: { $eq: new mongoose.Types.ObjectId(req.user.id) } } });
        if (team) {
            await Team.updateOne({ _id: team._id }, { $pull: { members: new mongoose.Types.ObjectId(req.params.id) } });
        }
        const task = await Task.find({ assigned_to: { $elemMatch: { $eq: new mongoose.Types.ObjectId(req.user.id) } } });
        if (task) {
            //delete userid from assigned_to
            await Task.updateMany({ assigned_to: { $elemMatch: { $eq: new mongoose.Types.ObjectId(req.user.id) } } }, { $pull: { assigned_to: new mongoose.Types.ObjectId(req.params.id) } });
        }
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const updateUser = async (req, res) => {
    try {
        const user = User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
        }
        const { name, dob, email, role, username, password, team } = req.body;
        const updateFields = {};
        if (name) updateFields.name = name;
        if (dob) updateFields.dob = dob;
        if (email) updateFields.email = email;
        if (role) updateFields.role = role;
        const authUpdateFields = {};
        if (username) authUpdateFields.username = username;
        if (password) { authUpdateFields.password = hashedPassword; const hashedPassword = await bcrypt.hash(password, 10); }
        if (role) authUpdateFields.role = role;
        console.log(updateFields);
        console.log(authUpdateFields);
        if (updateFields) await User.updateOne({ _id: req.params.id }, updateFields);
        if (authUpdateFields) await Auth.updateOne({ user: new mongoose.Types.ObjectId(req.params.id) }, authUpdateFields);
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
module.exports = { getUser, getUsers, addUser, deleteUser, updateUser, findByName, getMe };