const Team = require('./team.model');
const User = require('./user.model');
const Project = require('./project.model');
const getTeamWithMembers = async (teamId) => {
    try {
        const team = await Team.findById(teamId).populate('members');
        return team;
    } catch (error) {
        console.error(error);
    }
};

module.exports = { getTeamWithMembers };