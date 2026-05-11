const fs = require("fs");
const path = require("path");

const { MongoClient, BSON, ObjectId } = require(path.join(
  __dirname,
  "..",
  "server",
  "node_modules",
  "mongodb"
));

const args = new Set(process.argv.slice(2));
const uriArgIndex = process.argv.findIndex((arg) => arg === "--uri");
const dbArgIndex = process.argv.findIndex((arg) => arg === "--db");

const uri =
  uriArgIndex >= 0 && process.argv[uriArgIndex + 1]
    ? process.argv[uriArgIndex + 1]
    : process.env.MONGODB_URI || "mongodb://localhost:27017/cpm";
const dbName =
  dbArgIndex >= 0 && process.argv[dbArgIndex + 1]
    ? process.argv[dbArgIndex + 1]
    : new URL(uri).pathname.replace(/^\//, "") || "cpm";
const shouldReset = args.has("--reset");

const repoRoot = path.join(__dirname, "..");
const dataDir = path.join(repoRoot, "exampleDB", "assignment_test_100");

const imports = [
  ["cpm.users.json", "users"],
  ["cpm.auths.json", "auths"],
  ["cpm.skills.json", "skills"],
  ["cpm.stage_templates.json", "stage_templates"],
  ["cpm.contacts.json", "contacts"],
  ["cpm.teams.json", "teams"],
  ["cpm.projects.json", "projects"],
  ["cpm.tasks.json", "tasks"],
];

function readSeed(fileName) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing seed file: ${filePath}`);
  }
  return BSON.EJSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function upsertMany(collection, docs) {
  if (!docs.length) return { matched: 0, upserted: 0, modified: 0 };
  const result = await collection.bulkWrite(
    docs.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    })),
    { ordered: false }
  );

  return {
    matched: result.matchedCount,
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  };
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);

    if (shouldReset) {
      console.log("Resetting assignment test data...");
      await db.collection("tasks").deleteMany({
        _id: {
          $gte: new ObjectId("68a100000000000000003001"),
          $lte: new ObjectId("68a100000000000000003100"),
        },
      });
      await db.collection("projects").deleteMany({
        _id: {
          $gte: new ObjectId("68a100000000000000000201"),
          $lte: new ObjectId("68a100000000000000000212"),
        },
      });
      await db.collection("teams").deleteMany({
        _id: {
          $gte: new ObjectId("68a100000000000000000101"),
          $lte: new ObjectId("68a100000000000000000104"),
        },
      });
      await db.collection("auths").deleteMany({
        _id: {
          $gte: new ObjectId("68a100000000000000001001"),
          $lte: new ObjectId("68a100000000000000001032"),
        },
      });
      await db.collection("users").deleteMany({
        email: /@student\.cpm\.edu\.vn$/,
      });
      await db.collection("skills").deleteMany({
        _id: {
          $gte: new ObjectId("68a100000000000000005001"),
          $lte: new ObjectId("68a100000000000000005200"),
        },
      });
      await db.collection("stage_templates").deleteMany({
        _id: new ObjectId("68a100000000000000006001"),
      });
      await db.collection("contacts").deleteMany({
        _id: new ObjectId("68a100000000000000007001"),
      });
    }

    for (const [fileName, collectionName] of imports) {
      const docs = readSeed(fileName);
      const result = await upsertMany(db.collection(collectionName), docs);
      console.log(
        `${collectionName}: ${docs.length} docs, matched=${result.matched}, modified=${result.modified}, upserted=${result.upserted}`
      );
    }

    const counts = {
      users: await db.collection("users").countDocuments({
        email: /@student\.cpm\.edu\.vn$/,
      }),
      auths: await db.collection("auths").countDocuments({
        _id: {
          $gte: new ObjectId("68a100000000000000001001"),
          $lte: new ObjectId("68a100000000000000001032"),
        },
      }),
      teams: await db.collection("teams").countDocuments({
        _id: {
          $gte: new ObjectId("68a100000000000000000101"),
          $lte: new ObjectId("68a100000000000000000104"),
        },
      }),
      projects: await db.collection("projects").countDocuments({
        _id: {
          $gte: new ObjectId("68a100000000000000000201"),
          $lte: new ObjectId("68a100000000000000000212"),
        },
      }),
      tasks: await db.collection("tasks").countDocuments({
        _id: {
          $gte: new ObjectId("68a100000000000000003001"),
          $lte: new ObjectId("68a100000000000000003100"),
        },
      }),
      skills: await db.collection("skills").countDocuments({
        _id: {
          $gte: new ObjectId("68a100000000000000005001"),
          $lte: new ObjectId("68a100000000000000005200"),
        },
      }),
      stage_templates: await db.collection("stage_templates").countDocuments({
        _id: new ObjectId("68a100000000000000006001"),
      }),
      contacts: await db.collection("contacts").countDocuments({
        _id: new ObjectId("68a100000000000000007001"),
      }),
    };

    console.log("Verification:", counts);
    console.log("Done. Test accounts use the same password as janesmith.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
