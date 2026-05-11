const mongoose = require("mongoose");
const Project = require("../models/project.model");
const Task = require("../models/task.model");
const StageTemplate = require("../models/stageTemplate.model");

async function run() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/cpm";
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const defaultStages = Project.normalizeStages(Project.DEFAULT_STAGES);
  const defaultStageKey = defaultStages[0]?.key || "backlog";

  const legacyTeamCursor = Project.collection.find({
    $or: [
      { teams: { $exists: false } },
      { teams: null },
      { teams: { $size: 0 } },
    ],
    team: { $exists: true, $ne: null },
  });
  while (await legacyTeamCursor.hasNext()) {
    const project = await legacyTeamCursor.next();
    await Project.collection.updateOne(
      { _id: project._id },
      { $set: { teams: [project.team] } }
    );
  }

  const missingLegacyTeamCursor = Project.collection.find({
    $or: [{ team: { $exists: false } }, { team: null }],
    teams: { $exists: true },
  });
  while (await missingLegacyTeamCursor.hasNext()) {
    const project = await missingLegacyTeamCursor.next();
    if (!Array.isArray(project.teams) || project.teams.length === 0) {
      continue;
    }
    await Project.collection.updateOne(
      { _id: project._id },
      { $set: { team: project.teams[0] } }
    );
  }

  const projectResult = await Project.updateMany(
    {
      $or: [
        { stages: { $exists: false } },
        { stages: null },
        { stages: { $size: 0 } },
      ],
    },
    { $set: { stages: defaultStages } }
  );

  const taskResult = await Task.updateMany(
    {
      $or: [
        { stage: { $exists: false } },
        { stage: null },
        { stage: "" },
      ],
    },
    { $set: { stage: defaultStageKey } }
  );

  await StageTemplate.updateOne(
    { name: "Default Delivery" },
    {
      $setOnInsert: {
        name: "Default Delivery",
        description: "General software delivery flow",
        stages: defaultStages,
      },
    },
    { upsert: true }
  );

  console.log(
    JSON.stringify(
      {
        projectsMatched: projectResult.matchedCount,
        projectsModified: projectResult.modifiedCount,
        tasksMatched: taskResult.matchedCount,
        tasksModified: taskResult.modifiedCount,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
