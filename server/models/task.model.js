const mongoose = require("mongoose");
const taskSchema = new mongoose.Schema({
	title: { type: String, required: true },
	description: { type: String },
	due_date: { type: Number },
	status: { type: String },
	project: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "projects",
		required: true,
	},
	assigned_to: [
		{ type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
	],

	// New fields for task assignment
	difficulty: { type: Number, default: 2, min: 1, max: 4 }, // Độ khó: 1=Basic, 2=Easy, 3=Medium, 4=Hard
	priority: { type: Number, default: 3, min: 1, max: 5 }, // Mức độ ưu tiên: 1=Very Low, 2=Low, 3=Medium, 4=High, 5=Critical
	can_parallelize: { type: Boolean, default: true }, // Task có thể giao nhiều người
});

// Validation: Task must have at least 1 user assigned
taskSchema.pre("save", function (next) {
	if (!this.assigned_to || this.assigned_to.length === 0) {
		next(new Error("Task must have at least one user assigned"));
	} else {
		next();
	}
});

const Task = mongoose.model("tasks", taskSchema);
module.exports = Task;
