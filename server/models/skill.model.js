const mongoose = require("mongoose");

const skillSchema = new mongoose.Schema({
	name: { type: String, required: true, trim: true, unique: true },
	description: { type: String, trim: true, default: "" },
});

const Skill = mongoose.model("skills", skillSchema);
module.exports = Skill;