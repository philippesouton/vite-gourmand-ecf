const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SCHEMA_PATH = path.join(__dirname, "schema_postgresql_v2.sql");

async function initDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing in .env");
  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf-8");
  await pool.query(schemaSql);
  console.log("DB ready (postgres)");
}

module.exports = { pool, initDb };
