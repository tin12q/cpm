const Team = require('../models/team.model');
const mongoose = require('mongoose');
const getTeams = async (req, res) => {
    try {
        const teams = await Team.find();
        res.json(teams);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const getTeamWithId = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        res.json(team);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const userInTeam = async (req, res) => {
    const { page = 1, limit = 12 } = req.query;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    try {
        const users = await Team.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'members',
                    foreignField: '_id',
                    as: 'members'
                }
            },
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(req.params.id)
                }
            },
        ]);

        const results = users[0].members.slice(startIndex, endIndex);

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const addTeam = async (req, res) => {
    try {
        const { name, members } = req.body;
        const team = new Team({
            name, members: members.map(
                (member) => new mongoose.Types.ObjectId(member)
            )
        });
        await team.save();
        res.status(201).json({ message: 'Team added successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
module.exports = { getTeams, getTeamWithId, userInTeam, addTeam };