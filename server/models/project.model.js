const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
	title: { type: String, required: true },
	description: { type: String },
	due_date: { type: Number },
	status: { type: String },
	teams: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "teams",
			required: true,
		},
	],
});

// Validation: Project must have at least 1 team
projectSchema.pre("save", function (next) {
	if (!this.teams || this.teams.length === 0) {
		next(new Error("Project must have at least one team"));
	} else {
		next();
	}
});

const Project = mongoose.model("projects", projectSchema);

module.exports = Project;
