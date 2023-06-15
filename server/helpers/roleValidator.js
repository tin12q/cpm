const jwt = require('jsonwebtoken');

const role = [[3, 1, 1, 1], [3, 2, 3, 2], [3, 1, 3, 1], [3, 1, 2, 1]];

function roleNum(role) {
    switch (role) {
        case 'admin':
            return 1;
        case 'manager':
            return 2;
        case 'employee':
            return 3;
        default:
            return 4;
    }
}


const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({error: 'Missing authorization header'});
        }
        const token = authHeader.split(' ')[1];


        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decodedToken;

        next();
    } catch (error) {
        res.status(401).json({error: error.message});
    }
};

function isRoleValid(userRole, checkRole) {
    if (role[checkRole.collection][checkRole.task] >= roleNum(userRole)) {
        return true;
    }
    return false;
}

const requireRole = (checkRole) => {
    return (req, res, next) => {
        if (!isRoleValid(req.user.role, checkRole)) {
            return res.status(403).json({error: 'Unauthorized'});
        }
        next();
    };
};
module.exports = {requireRole, authenticate};