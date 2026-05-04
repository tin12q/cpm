const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Auth = require('../models/auth.model');
const User = require('../models/user.model');

function escapeRegex(input = "") {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

//TODO: fix this
const register = async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new Auth({ username, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const normalizedLogin = String(username || "").trim();

        let auth = await Auth.findOne({ username: normalizedLogin });

        // Fallback: allow logging in by display name or email
        if (!auth && normalizedLogin) {
            const exactCi = new RegExp(`^${escapeRegex(normalizedLogin)}$`, 'i');
            const person = await User.findOne({
                $or: [{ email: exactCi }, { name: exactCi }]
            }).select('_id');

            if (person) {
                auth = await Auth.findOne({ user: person._id });
            }
        }

        if (!auth) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isPasswordValid = await bcrypt.compare(password, auth.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({
            id: auth.user,
            role: auth.role
        }, process.env.JWT_SECRET);

        res.set('Authorization', "Bearer " + token);
        res.json({ message: 'Login successful', role: auth.role, id : auth.user});
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};


module.exports = {
    register,
    login,

};
