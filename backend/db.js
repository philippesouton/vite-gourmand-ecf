const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = path.join(__dirname, "database.sqlite");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

const db = new sqlite3.Database(DB_PATH);

function initDb() {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema, (err) => {
    if (err) {
      console.error("DB init error:", err);
      process.exit(1);
    }
    console.log("DB ready:", DB_PATH);
  });
}

module.exports = { db, initDb };
