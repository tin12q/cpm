const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
	name: { type: String },
	dob: { type: Number },
	email: { type: String },
	role: { type: String },

	// New fields for task assignment
	skills: [{ type: String }], // Kỹ năng người dùng
	productivity_score: { type: Number, default: 0.8, min: 0, max: 1 }, // Hiệu suất làm việc (0-1)
	on_time_rate: { type: Number, default: 85, min: 0, max: 100 }, // Tỷ lệ hoàn thành đúng hạn (%)
	current_task_count: { type: Number, default: 0, min: 0 }, // Số task đang làm
});
const User = mongoose.model("users", userSchema);
module.exports = User;
