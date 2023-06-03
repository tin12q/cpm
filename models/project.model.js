const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    due_date: { type: Number },
    status: { type: String },
  
  });
  
const Project = mongoose.model('projects', projectSchema);

module.exports = Project;