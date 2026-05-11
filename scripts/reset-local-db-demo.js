const path = require("path");

const { MongoClient, BSON } = require(path.join(
  __dirname,
  "..",
  "server",
  "node_modules",
  "mongodb"
));

const seed = require(path.join(__dirname, "..", "generate-assignment-test-data.js"));

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

const collections = [
  ["users", seed.users],
  ["auths", seed.auths],
  ["skills", seed.skills],
  ["stage_templates", seed.stage_templates],
  ["contacts", seed.contacts],
  ["teams", seed.teams],
  ["projects", seed.projects],
  ["tasks", seed.tasks],
];

function toBsonDocs(docs) {
  return BSON.EJSON.parse(JSON.stringify(docs));
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    console.log(`Dropping database '${dbName}' at ${uri}...`);
    await db.dropDatabase();

    for (const [collectionName, docs] of collections) {
      const bsonDocs = toBsonDocs(docs);
      if (bsonDocs.length > 0) {
        await db.collection(collectionName).insertMany(bsonDocs, { ordered: true });
      }
      console.log(`${collectionName}: inserted ${bsonDocs.length}`);
    }

    const counts = {};
    for (const [collectionName] of collections) {
      counts[collectionName] = await db.collection(collectionName).countDocuments();
    }
    counts.task_notes = await db.collection("task_notes").countDocuments();

    console.log("Verification:", counts);
    console.log("Login accounts:");
    console.log("- admin: janesmith / 123");
    console.log("- manager: maitran / 123");
    console.log("- employee: annguyen / 123");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
