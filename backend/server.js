const mongoose = require("mongoose");

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });



const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { db, initDb } = require("./db");
const { requireAuth, requireRole } = require("./middleware/auth");

const { connectMongo } = require("./mongo");
connectMongo();

initDb();

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---------- AUTH ----------

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, phone, email, address, password } = req.body || {};
    if (!firstName || !lastName || !phone || !email || !address || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(password);
    if (!strongPw) return res.status(400).json({ error: "Weak password" });

    const passwordHash = await bcrypt.hash(password, 10);

    const stmt = db.prepare(`
      INSERT INTO users (firstName, lastName, phone, email, address, passwordHash, role)
      VALUES (?, ?, ?, ?, ?, ?, 'USER')
    `);

    stmt.run([firstName, lastName, phone, email.toLowerCase(), address, passwordHash], function (err) {
      if (err) {
        if (String(err).includes("UNIQUE")) return res.status(409).json({ error: "Email already used" });
        return res.status(500).json({ error: "DB error" });
      }
      return res.status(201).json({ id: this.lastID });
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing email/password" });

  db.get(
    `SELECT id, email, passwordHash, role FROM users WHERE email = ?`,
    [email.toLowerCase()],
    async (err, row) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (!row) return res.status(401).json({ error: "Invalid credentials" });

      const ok = await bcrypt.compare(password, row.passwordHash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      if (!process.env.JWT_SECRET) return res.status(500).json({ error: "JWT_SECRET missing" });

      const token = jwt.sign(
        { id: row.id, email: row.email, role: row.role },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      res.json({ token, role: row.role });
    }
  );
});

// Forgot password (réponse neutre)
app.post("/api/auth/forgot", (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Missing email" });

  db.get(`SELECT id FROM users WHERE email = ?`, [email.toLowerCase()], (err, row) => {
    if (err) return res.status(500).json({ error: "DB error" });

    // Toujours OK pour ne pas révéler l'existence d'un compte
    if (!row) return res.json({ ok: true });

    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.run(
      `INSERT INTO password_resets (userId, token, expiresAt) VALUES (?, ?, ?)`,
      [row.id, token, expires],
      (err2) => {
        if (err2) return res.status(500).json({ error: "DB error" });
        console.log("Password reset token (dev):", token);
        return res.json({ ok: true });
      }
    );
  });
});

// ---------- ORDERS (NoSQL) ----------

let OrderEvent;
try {
  OrderEvent = require("./models/OrderEvent");
} catch {
  OrderEvent = null;
}

app.post("/api/orders/simulate", async (req, res) => {
  try {
    if (!OrderEvent || mongoose.connection.readyState !== 1) {
    return res.json({ ok: true, stored: false });
  }
    const { menuId, persons } = req.body || {};
    if (!menuId || !persons) return res.status(400).json({ error: "Missing fields" });

    db.get(
      `SELECT id, theme, diet, minPersons, priceMin FROM menus WHERE id = ?`,
      [Number(menuId)],
      async (err, menu) => {
        if (err) return res.status(500).json({ error: "DB error" });
        if (!menu) return res.status(404).json({ error: "Menu not found" });

        const p = Number(persons);
        if (!Number.isFinite(p) || p < menu.minPersons) {
          return res.status(400).json({ error: "Invalid persons" });
        }
        try {
          await OrderEvent.create({
            menuId: menu.id,
            persons: p,
            priceMin: menu.priceMin,
            theme: menu.theme,
            diet: menu.diet,
          });

          return res.json({ ok: true, stored: true });
        } catch (e) {
          console.warn("[mongo] store failed:", e.message);
          return res.json({ ok: true, stored: false });
        }
      }
    );
  } catch (e) {
    console.warn("[mongo] store failed:", e.message);
    return res.json({ ok: true, stored: false });
  }
});

// ---------- STATS (ADMIN/EMPLOYEE) ----------

app.get("/api/admin/stats/orders", requireAuth, requireRole("ADMIN", "EMPLOYEE"), async (req, res) => {
  try {
    // Si NoSQL non dispo : on répond proprement (pas de crash)
    if (!OrderEvent || mongoose.connection.readyState !== 1) {
      return res.json({
        ok: true,
        stored: false,
        data: { byTheme: [], byDiet: [] }
      });
    }

    const byTheme = await OrderEvent.aggregate([
      { $group: { _id: "$theme", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const byDiet = await OrderEvent.aggregate([
      { $group: { _id: "$diet", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return res.json({ ok: true, stored: true, data: { byTheme, byDiet } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
});



// ---------- MENUS ----------

// Public list
app.get("/api/menus", (req, res) => {
  db.all(
    `SELECT id, title, description, theme, diet, minPersons, priceMin
     FROM menus WHERE isActive = 1 ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// Create menu (ADMIN/EMPLOYEE)
app.post("/api/menus", requireAuth, requireRole("ADMIN", "EMPLOYEE"), (req, res) => {
  const { title, description, theme, diet, minPersons, priceMin, isActive = 1 } = req.body || {};
  if (!title || !description || !theme || !diet || minPersons == null || priceMin == null) {
    return res.status(400).json({ error: "Missing fields" });
  }

  db.run(
    `INSERT INTO menus (title, description, theme, diet, minPersons, priceMin, isActive)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, description, theme, diet, Number(minPersons), Number(priceMin), isActive ? 1 : 0],
    function (err) {
      if (err) return res.status(500).json({ error: "DB error" });
      res.status(201).json({ id: this.lastID });
    }
  );
});

// List all menus (ADMIN/EMPLOYEE) inclut inactifs
app.get("/api/admin/menus", requireAuth, requireRole("ADMIN", "EMPLOYEE"), (req, res) => {
  db.all(
    `SELECT id, title, description, theme, diet, minPersons, priceMin, isActive
     FROM menus ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// Toggle active
app.patch("/api/admin/menus/:id/active", requireAuth, requireRole("ADMIN", "EMPLOYEE"), (req, res) => {
  const id = Number(req.params.id);
  const { isActive } = req.body || {};
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  if (isActive !== 0 && isActive !== 1) return res.status(400).json({ error: "isActive must be 0 or 1" });

  db.run(`UPDATE menus SET isActive = ? WHERE id = ?`, [isActive, id], function (err) {
    if (err) return res.status(500).json({ error: "DB error" });
    if (this.changes === 0) return res.status(404).json({ error: "Menu not found" });
    res.json({ ok: true });
  });
});


const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on http://127.0.0.1:${PORT}`);
});
