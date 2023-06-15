const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    name: {type: String},
    dob: {type: Number},
    email: {type: String},
    role: {type: String},
});
const User = mongoose.model('users', userSchema);
module.exports = User;