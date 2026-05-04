const mongoose = require("mongoose");

const taskNoteSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "tasks",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    content: { type: String, required: true, trim: true },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("task_notes", taskNoteSchema);
