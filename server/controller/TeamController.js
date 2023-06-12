const Team = require('../models/team.model');
const mongoose = require('mongoose');
const getTeams = async (req, res) => {
    try {
        const teams = await Team.find();
        res.json(teams);
    }
    catch (error) {
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

    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const userInTeam = async (req, res) => {
    try {
        console.log(req.params.id);
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
        res.json(users);
    }   

    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
module.exports = { getTeams, getTeamWithId, userInTeam };