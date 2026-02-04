require("dotenv").config();
const { pool } = require("../db");

async function main() {
  const email = process.argv[2];
  const role = process.argv[3];

  if (!email || !role) {
    console.log("Usage: npm run promote -- <email> <ADMIN|EMPLOYE|USER>");
    process.exit(1);
  }

  const r = await pool.query("SELECT role_id FROM roles WHERE libelle=$1", [role]);
  if (r.rowCount === 0) throw new Error("Role not found");

  const up = await pool.query(
    "UPDATE utilisateur SET role_id=$1, updated_at=NOW() WHERE email=$2 RETURNING utilisateur_id,email",
    [r.rows[0].role_id, email]
  );

  if (up.rowCount === 0) {
    console.log("No user updated (email not found)");
  } else {
    console.log("OK promoted:", up.rows[0]);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
