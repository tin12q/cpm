const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  due_date: { type: Number },
  status: { type: String, default: "in progress" },
  stage: { type: String, default: "backlog", trim: true },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "projects",
    required: true,
  },
  assigned_to: [
    { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  ],
  difficulty: { type: Number, default: 2, min: 1, max: 4 },
  priority: { type: Number, default: 3, min: 1, max: 5 },
  can_parallelize: { type: Boolean, default: true },
  required_skills: [{ type: String, trim: true }],
  skills_required: [{ type: String, trim: true }],
});

taskSchema.pre("save", function validateTask(next) {
  if (!this.assigned_to || this.assigned_to.length === 0) {
    next(new Error("Task must have at least one user assigned"));
    return;
  }

  if (!this.stage) {
    this.stage = "backlog";
  }

  if ((!this.required_skills || this.required_skills.length === 0) && Array.isArray(this.skills_required)) {
    this.required_skills = this.skills_required.filter(Boolean);
  }

  if ((!this.skills_required || this.skills_required.length === 0) && Array.isArray(this.required_skills)) {
    this.skills_required = this.required_skills.filter(Boolean);
  }

  next();
});

const Task = mongoose.model("tasks", taskSchema);
module.exports = Task;
