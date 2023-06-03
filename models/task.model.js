const mongoose = require('mongoose');
const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    due_date: { type: Number },
    status: { type: String },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  
  });
  
  const Task = mongoose.model('tasks', taskSchema);
export default Task;
