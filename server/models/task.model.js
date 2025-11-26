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
	total_hours: { type: Number, default: 0 }, // Tổng số giờ cần làm
	priority: { type: Number, default: 3, min: 1, max: 5 }, // Mức độ ưu tiên (1-5)
	skills_required: [{ type: String }], // Kỹ năng cần có
	can_parallelize: { type: Boolean, default: true }, // Task có thể giao nhiều người
	number_of_people_needed: { type: Number, default: 1, min: 1 }, // Số người cần để hoàn thành task
});

const Task = mongoose.model("tasks", taskSchema);
module.exports = Task;
