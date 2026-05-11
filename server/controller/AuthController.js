const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Auth = require('../models/auth.model');
const User = require('../models/user.model');

function escapeRegex(input = "") {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const register = async (req, res) => {
    try {
        const { name, email, username, password, role } = req.body;
        const normalizedUsername = String(username || email || "").trim();
        const normalizedEmail = String(email || normalizedUsername).trim();
        const normalizedName = String(name || normalizedUsername).trim();
        const normalizedRole = String(role || "employee").trim().toLowerCase();
        const validRoles = ["superadmin", "admin", "manager", "employee"];

        if (!normalizedUsername || !password || !normalizedName) {
            return res.status(400).json({ error: 'Name, username, and password are required' });
        }

        if (!validRoles.includes(normalizedRole)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const usernameRegex = new RegExp(`^${escapeRegex(normalizedUsername)}$`, 'i');
        const emailRegex = new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i');
        const existingAuth = await Auth.findOne({ username: usernameRegex });
        const existingUser = await User.findOne({ email: emailRegex });

        if (existingAuth || existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        const person = new User({
            name: normalizedName,
            email: normalizedEmail,
            role: normalizedRole,
        });
        await person.save();

        const hashedPassword = await bcrypt.hash(password, 10);
        const auth = new Auth({
            username: normalizedUsername,
            password: hashedPassword,
            role: normalizedRole,
            user: person._id,
        });
        await auth.save();

        res.status(201).json({
            message: 'User registered successfully',
            id: person._id,
            role: normalizedRole,
        });
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
