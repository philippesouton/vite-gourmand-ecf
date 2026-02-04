let MongoClient = null;
try {
  ({ MongoClient } = require("mongodb"));
} catch (e) {
  console.warn("MongoDB driver not installed. Stats Mongo disabled.");
}

let client = null;
let cachedDb = null;

async function getMongoDb() {
  if (!MongoClient) return null;
  const url = process.env.MONGO_URL;
  if (!url) return null;

  if (cachedDb) return cachedDb;

  client = new MongoClient(url);
  await client.connect();
  const dbName = process.env.MONGO_DB || "vite_gourmand";
  cachedDb = client.db(dbName);
  return cachedDb;
}

module.exports = { getMongoDb };
