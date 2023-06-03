const mongoose = require('mongoose');
const authSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String },
    email: { type: String },
    role: { type: String }
    });
const Auth = mongoose.model('auth', authSchema);
module.exports = Auth;