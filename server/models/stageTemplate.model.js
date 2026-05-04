const mongoose = require("mongoose");
const Project = require("./project.model");

const stageTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true, default: "" },
    is_default: { type: Boolean, default: false },
    stages: {
      type: [
        new mongoose.Schema(
          {
            key: { type: String, required: true, trim: true },
            name: { type: String, required: true, trim: true },
            color: { type: String, trim: true, default: "slate" },
            order: { type: Number, default: 0 },
          },
          { _id: false }
        ),
      ],
      default: () => Project.normalizeStages(Project.DEFAULT_STAGES),
    },
  },
  { timestamps: true }
);

stageTemplateSchema.pre("validate", function validateTemplate(next) {
  this.stages = Project.normalizeStages(this.stages);
  next();
});

module.exports = mongoose.model("stage_templates", stageTemplateSchema);
