const mongoose = require("mongoose");

const DEFAULT_PROJECT_STAGES = [
  { key: "backlog", name: "Backlog", color: "amber" },
  { key: "in-progress", name: "In Progress", color: "blue" },
  { key: "review", name: "Review", color: "violet" },
  { key: "done", name: "Done", color: "green" },
];

const stageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, trim: true, default: "slate" },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    code: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

function slugifyStageKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeStages(inputStages) {
  const source = Array.isArray(inputStages) && inputStages.length > 0 ? inputStages : DEFAULT_PROJECT_STAGES;
  const seen = new Set();

  return source
    .map((stage, index) => {
      const name = String(stage?.name || stage?.label || stage?.key || "").trim();
      const key = slugifyStageKey(stage?.key || name || `stage-${index + 1}`);
      if (!name || !key || seen.has(key)) {
        return null;
      }
      seen.add(key);
      return {
        key,
        name,
        color: String(stage?.color || "slate").trim() || "slate",
        order: Number.isFinite(stage?.order) ? Number(stage.order) : index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .map((stage, index) => ({ ...stage, order: index }));
}

function normalizeCustomer(inputCustomer) {
  if (!inputCustomer) {
    return { name: "", code: "", description: "" };
  }

  if (typeof inputCustomer === "string") {
    return {
      name: String(inputCustomer).trim(),
      code: "",
      description: "",
    };
  }

  return {
    name: String(inputCustomer?.name || inputCustomer?.title || "").trim(),
    code: String(inputCustomer?.code || "").trim(),
    description: String(inputCustomer?.description || "").trim(),
  };
}

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    due_date: { type: Number },
    status: { type: String },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "teams",
      default: null,
    },
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "teams",
        required: true,
      },
    ],
    stages: {
      type: [stageSchema],
      default: () => normalizeStages(DEFAULT_PROJECT_STAGES),
    },
    stage_template_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "stage_templates",
      default: null,
    },
    customer: {
      type: customerSchema,
      default: () => normalizeCustomer(null),
    },
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "contacts",
      },
    ],
    primary_contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "contacts",
      default: null,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

projectSchema.pre("validate", function validateProject(next) {
  if ((!this.teams || this.teams.length === 0) && this.team) {
    this.teams = [this.team];
  }
  if ((!this.team || String(this.team).trim() === "") && this.teams?.length > 0) {
    [this.team] = this.teams;
  }
  if (!this.teams || this.teams.length === 0) {
    next(new Error("Project must have at least one team"));
    return;
  }

  this.stages = normalizeStages(this.stages);
  this.customer = normalizeCustomer(this.customer);
  next();
});

const Project = mongoose.model("projects", projectSchema);
Project.DEFAULT_STAGES = DEFAULT_PROJECT_STAGES;
Project.normalizeStages = normalizeStages;
Project.normalizeCustomer = normalizeCustomer;

module.exports = Project;
