const mongoose = require('mongoose');
const authSchema = new mongoose.Schema({
    username: {type: String, required: true},
    password: {type: String},
    role: {type: String},
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'users'}
});
const Auth = mongoose.model('auths', authSchema);
module.exports = Auth;