const { db } = require("./db");

const email = "bernard.lefenec@gmail.com";

db.run(
  `UPDATE users SET role='ADMIN' WHERE email = ?`,
  [email.toLowerCase()],
  function (err) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log("Updated users:", this.changes);
    process.exit(0);
  }
);
