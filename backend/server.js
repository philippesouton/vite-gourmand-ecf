require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { pool } = require("./db");
const { requireAuth, requireRole } = require("./middleware/auth");
const { getMongoDb } = require("./mongo");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function isBordeaux(city) {
  return String(city || "").trim().toLowerCase() === "bordeaux";
}
function generateOrderNumber() {
  return `VG-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}
function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function computePricing({ pricePerPerson, minPersons }, persons, city, distanceKm) {
  const p = Number(persons);
  const min = Number(minPersons);
  const unit = Number(pricePerPerson);

  if (!Number.isFinite(p) || p <= 0) throw new Error("persons invalid");
  if (p < min) throw new Error("persons below minimum");

  const brut = round2(p * unit);
  const reductionPercent = p >= (min + 5) ? 10 : 0;
  const reductionEur = round2(brut * (reductionPercent / 100));
  const net = round2(brut - reductionEur);

  let km = 0;
  let delivery = 0;
  if (!isBordeaux(city)) {
    km = Number(distanceKm);
    if (!Number.isFinite(km) || km < 0) throw new Error("distanceKm required outside Bordeaux");
    delivery = round2(5 + 0.59 * km);
  }
  const total = round2(net + delivery);
  return { brut, reductionPercent, reductionEur, net, km, delivery, total };
}
function isStrongPassword(pw) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(String(pw));
}

const ORDER_STATUSES = new Set([
  "en_attente","accepte","en_preparation","en_livraison","livre","attente_retour_materiel","terminee","annulee"
]);
const AVIS_STATUTS = new Set(["pending", "approved", "rejected"]);
const STATUS_TRANSITIONS = {
  en_attente: ["accepte","annulee"],
  accepte: ["en_preparation","annulee"],
  en_preparation: ["en_livraison","annulee"],
  en_livraison: ["livre"],
  livre: ["attente_retour_materiel","terminee"],
  attente_retour_materiel: ["terminee"],
  terminee: [],
  annulee: []
};
function assertStatut(s){ if(!ORDER_STATUSES.has(s)) throw new Error("Invalid statut"); }
function assertTransition(cur,next){
  const allowed = STATUS_TRANSITIONS[cur] || [];
  if(!allowed.includes(next)) throw new Error(`Transition interdite: ${cur} -> ${next}`);
}
function assertAvisStatut(s){ if(!AVIS_STATUTS.has(s)) throw new Error("Invalid avis statut"); }

async function tryInsertOrderToMongo(doc) {
  try {
    const db = await getMongoDb();
    if (!db) return;
    await db.collection("orders").insertOne(doc);
  } catch (e) {
    console.warn("Mongo insert failed:", e.message);
  }
}

async function logEmail({ to, subject, body, kind, relatedId }) {
  try {
    await pool.query(
      `INSERT INTO email_log (to_email, subject, body, kind, related_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [to, subject, body, kind, relatedId || null]
    );
  } catch (e) {
    console.warn("Email log failed:", e.message);
  }
  console.log("[email stub]", { to, subject, kind });
}

function listGalleryImages() {
  try {
    const galleryDir = path.resolve(__dirname, "../assets/gallery");
    const files = [];

    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(webp|png|jpg|jpeg)$/i.test(entry.name)) {
          const rel = path.relative(galleryDir, full).replace(/\\/g, "/");
          files.push(rel);
        }
      }
    }

    walk(galleryDir);

    return files
      .sort((a, b) => a.localeCompare(b))
      .map((rel) => ({
        url: `assets/gallery/${rel}`,
        alt: rel.split("/").pop().replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ")
      }));
  } catch (e) {
    console.warn("Gallery read failed:", e.message);
    return [];
  }
}

app.get("/api/health", (req,res)=>res.json({ok:true}));

// -------- AUTH --------
app.post("/api/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, phone, email, address, password } = req.body || {};
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ error: "Missing fields" });
    if (!isStrongPassword(password)) return res.status(400).json({ error: "Weak password" });

    const hash = await bcrypt.hash(String(password), 10);

    const role = await pool.query("SELECT role_id FROM roles WHERE libelle='USER'");
    const role_id = role.rows[0].role_id;

    const ins = await pool.query(
      `INSERT INTO utilisateur (role_id, email, password_hash, prenom, nom, telephone, adresse)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING utilisateur_id`,
      [role_id, String(email).toLowerCase(), hash, firstName, lastName, phone || null, address || null]
    );

    await logEmail({
      to: String(email).toLowerCase(),
      subject: "Bienvenue chez Vite & Gourmand",
      body: `Bonjour ${firstName}, votre compte est bien créé.`,
      kind: "welcome",
      relatedId: ins.rows[0].utilisateur_id
    });

    res.status(201).json({ id: String(ins.rows[0].utilisateur_id) });
  } catch (e) {
    if (String(e.message).includes("duplicate")) return res.status(409).json({ error: "Email already used" });
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    const u = await pool.query(
      `SELECT u.utilisateur_id, u.email, u.password_hash, u.is_active, r.libelle AS role
       FROM utilisateur u JOIN roles r ON r.role_id=u.role_id
       WHERE u.email=$1`,
      [String(email).toLowerCase()]
    );
    if (u.rowCount === 0) return res.status(401).json({ error: "Invalid credentials" });
    const user = u.rows[0];
    if (!user.is_active) return res.status(403).json({ error: "Account disabled" });

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: String(user.utilisateur_id), email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );
    res.json({ token, role: user.role });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/auth/forgot", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Missing email" });

    const u = await pool.query(
      `SELECT utilisateur_id, prenom FROM utilisateur WHERE email=$1`,
      [String(email).toLowerCase()]
    );
    if (u.rowCount > 0) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 1000 * 60 * 60); // 1h
      await pool.query(
        `INSERT INTO password_reset (utilisateur_id, token, purpose, expires_at)
         VALUES ($1,$2,'reset',$3)`,
        [u.rows[0].utilisateur_id, token, expires]
      );
      await logEmail({
        to: String(email).toLowerCase(),
        subject: "Réinitialisation de mot de passe",
        body: `Bonjour ${u.rows[0].prenom}, lien: reset-password.html?token=${token}`,
        kind: "reset",
        relatedId: token
      });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/auth/reset", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: "Missing fields" });
    if (!isStrongPassword(password)) return res.status(400).json({ error: "Weak password" });

    const t = await pool.query(
      `SELECT id, utilisateur_id FROM password_reset
       WHERE token=$1 AND purpose='reset' AND expires_at > NOW()`,
      [String(token)]
    );
    if (t.rowCount === 0) return res.status(400).json({ error: "Invalid or expired token" });

    const hash = await bcrypt.hash(String(password), 10);
    await pool.query(
      `UPDATE utilisateur SET password_hash=$1, updated_at=NOW() WHERE utilisateur_id=$2`,
      [hash, t.rows[0].utilisateur_id]
    );
    await pool.query(`DELETE FROM password_reset WHERE id=$1`, [t.rows[0].id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/users/me", requireAuth, async (req, res) => {
  const r = await pool.query(
    `SELECT utilisateur_id, prenom, nom, email, telephone, adresse
     FROM utilisateur WHERE utilisateur_id=$1`,
    [String(req.user.id)]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "User not found" });
  res.json(r.rows[0]);
});

app.patch("/api/users/me", requireAuth, async (req, res) => {
  const { firstName, lastName, phone, address } = req.body || {};
  const r = await pool.query(
    `UPDATE utilisateur
     SET prenom=COALESCE($1, prenom),
         nom=COALESCE($2, nom),
         telephone=COALESCE($3, telephone),
         adresse=COALESCE($4, adresse),
         updated_at=NOW()
     WHERE utilisateur_id=$5
     RETURNING utilisateur_id, prenom, nom, email, telephone, adresse`,
    [firstName ?? null, lastName ?? null, phone ?? null, address ?? null, String(req.user.id)]
  );
  res.json(r.rows[0]);
});

// -------- MENUS --------
app.get("/api/menus", async (req, res) => {
  const theme = req.query.theme ? String(req.query.theme) : null;
  const regime = req.query.regime ? String(req.query.regime) : null;
  const minPersons = req.query.minPersons ? Number(req.query.minPersons) : null;
  const priceMin = req.query.priceMin ? Number(req.query.priceMin) : null;
  const priceMax = req.query.priceMax ? Number(req.query.priceMax) : null;

  const r = await pool.query(
    `SELECT menu_id AS id, titre AS title, description, theme, regime, conditions,
            nombre_personne_minimum AS "minPersons",
            prix_par_personne AS "pricePerPerson",
            stock_disponible AS stock,
            (prix_par_personne * nombre_personne_minimum) AS "priceMin",
            COALESCE(
              (SELECT json_agg(json_build_object('url', mi.url, 'alt', mi.alt) ORDER BY mi.menu_image_id)
               FROM menu_image mi
               WHERE mi.menu_id=menu.menu_id),
              '[]'::json
            ) AS images
     FROM menu
     WHERE is_active=true
       AND ($1::text IS NULL OR theme=$1)
       AND ($2::text IS NULL OR regime=$2)
       AND ($3::int IS NULL OR nombre_personne_minimum >= $3)
       AND ($4::numeric IS NULL OR (prix_par_personne * nombre_personne_minimum) >= $4)
       AND ($5::numeric IS NULL OR (prix_par_personne * nombre_personne_minimum) <= $5)
     ORDER BY menu_id DESC`,
    [theme, regime, Number.isFinite(minPersons) ? minPersons : null,
     Number.isFinite(priceMin) ? priceMin : null,
     Number.isFinite(priceMax) ? priceMax : null]
  );
  res.json(r.rows);
});

app.get("/api/menus/:id", async (req, res) => {
  const id = Number(req.params.id);
  const r = await pool.query(
    `SELECT menu_id AS id, titre AS title, description, theme, regime, conditions,
            nombre_personne_minimum AS "minPersons",
            prix_par_personne AS "pricePerPerson",
            stock_disponible AS stock,
            (prix_par_personne * nombre_personne_minimum) AS "priceMin"
     FROM menu
     WHERE menu_id=$1`,
    [id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "Menu not found" });

  const images = await pool.query(
    `SELECT menu_image_id AS id, url, alt FROM menu_image WHERE menu_id=$1 ORDER BY menu_image_id`,
    [id]
  );

  const plats = await pool.query(
    `SELECT p.plat_id, p.nom, p.type, p.description, a.allergene_id, a.libelle
     FROM plat p
     JOIN menu_plat mp ON mp.plat_id=p.plat_id
     LEFT JOIN plat_allergene pa ON pa.plat_id=p.plat_id
     LEFT JOIN allergene a ON a.allergene_id=pa.allergene_id
     WHERE mp.menu_id=$1
     ORDER BY p.type, p.nom`,
    [id]
  );

  const platMap = new Map();
  for (const row of plats.rows) {
    if (!platMap.has(row.plat_id)) {
      platMap.set(row.plat_id, {
        plat_id: row.plat_id,
        nom: row.nom,
        type: row.type,
        description: row.description,
        allergenes: []
      });
    }
    if (row.allergene_id) {
      platMap.get(row.plat_id).allergenes.push({
        allergene_id: row.allergene_id,
        libelle: row.libelle
      });
    }
  }

  res.json({
    menu: r.rows[0],
    images: images.rows,
    plats: Array.from(platMap.values())
  });
});

// -------- MENUS ADMIN/EMPLOYE --------
app.get("/api/admin/menus", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const r = await pool.query(
    `SELECT menu_id AS id, titre AS title, description, theme, regime, conditions,
            nombre_personne_minimum AS "minPersons",
            prix_par_personne AS "pricePerPerson",
            stock_disponible AS stock,
            is_active AS "isActive"
     FROM menu
     ORDER BY menu_id DESC`
  );
  res.json(r.rows);
});

app.get("/api/admin/gallery-images", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const items = listGalleryImages();
  res.json(items);
});

app.post("/api/admin/menus", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  try {
    const { title, description, theme, regime, conditions, minPersons, pricePerPerson, stock, isActive, images } = req.body || {};
    if (!title || !description || !minPersons || pricePerPerson == null) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ins = await client.query(
        `INSERT INTO menu (titre, description, theme, regime, conditions, nombre_personne_minimum, prix_par_personne, stock_disponible, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING menu_id`,
        [
          title, description,
          theme || null, regime || null, conditions || null,
          Number(minPersons),
          Number(pricePerPerson),
          stock != null ? Number(stock) : null,
          isActive !== false
        ]
      );

      const menuId = ins.rows[0].menu_id;
      const imageUrls = Array.isArray(images) ? images : [];
      for (const url of imageUrls) {
        if (!url) continue;
        await client.query(
          `INSERT INTO menu_image (menu_id, url, alt) VALUES ($1,$2,$3)`,
          [menuId, String(url), title]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ id: menuId });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/admin/menus/:id", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = await pool.query(`SELECT * FROM menu WHERE menu_id=$1`, [id]);
    if (cur.rowCount === 0) return res.status(404).json({ error: "Menu not found" });

    const body = req.body || {};
    const next = {
      title: body.title ?? cur.rows[0].titre,
      description: body.description ?? cur.rows[0].description,
      theme: body.theme ?? cur.rows[0].theme,
      regime: body.regime ?? cur.rows[0].regime,
      conditions: body.conditions ?? cur.rows[0].conditions,
      minPersons: body.minPersons ?? cur.rows[0].nombre_personne_minimum,
      pricePerPerson: body.pricePerPerson ?? cur.rows[0].prix_par_personne,
      stock: body.stock ?? cur.rows[0].stock_disponible,
      isActive: body.isActive ?? cur.rows[0].is_active
    };

    await pool.query(
      `UPDATE menu SET
         titre=$1, description=$2, theme=$3, regime=$4, conditions=$5,
         nombre_personne_minimum=$6, prix_par_personne=$7,
         stock_disponible=$8, is_active=$9, updated_at=NOW()
       WHERE menu_id=$10`,
      [
        next.title, next.description, next.theme, next.regime, next.conditions,
        Number(next.minPersons), Number(next.pricePerPerson),
        next.stock != null ? Number(next.stock) : null,
        Boolean(next.isActive), id
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/admin/menus/:id", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const id = Number(req.params.id);
  const r = await pool.query(
    `UPDATE menu SET is_active=false, updated_at=NOW() WHERE menu_id=$1 RETURNING menu_id`,
    [id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "Menu not found" });
  res.json({ ok: true });
});

app.post("/api/admin/menus/:id/images", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const id = Number(req.params.id);
  const { url, alt } = req.body || {};
  if (!url) return res.status(400).json({ error: "Missing url" });
  const ins = await pool.query(
    `INSERT INTO menu_image (menu_id, url, alt) VALUES ($1,$2,$3) RETURNING menu_image_id`,
    [id, url, alt || null]
  );
  res.status(201).json({ id: ins.rows[0].menu_image_id });
});

app.put("/api/admin/menus/:id/plats", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const id = Number(req.params.id);
  const platIds = Array.isArray(req.body?.platIds) ? req.body.platIds.map(Number) : [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM menu_plat WHERE menu_id=$1`, [id]);
    for (const pid of platIds) {
      if (Number.isFinite(pid)) {
        await client.query(`INSERT INTO menu_plat (menu_id, plat_id) VALUES ($1,$2)`, [id, pid]);
      }
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// -------- PLATS / ALLERGENES --------
app.get("/api/admin/plats", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const r = await pool.query(
    `SELECT p.plat_id, p.nom, p.type, p.description, a.allergene_id, a.libelle
     FROM plat p
     LEFT JOIN plat_allergene pa ON pa.plat_id=p.plat_id
     LEFT JOIN allergene a ON a.allergene_id=pa.allergene_id
     ORDER BY p.nom`
  );
  const map = new Map();
  for (const row of r.rows) {
    if (!map.has(row.plat_id)) {
      map.set(row.plat_id, {
        plat_id: row.plat_id,
        nom: row.nom,
        type: row.type,
        description: row.description,
        allergenes: []
      });
    }
    if (row.allergene_id) {
      map.get(row.plat_id).allergenes.push({ allergene_id: row.allergene_id, libelle: row.libelle });
    }
  }
  res.json(Array.from(map.values()));
});

app.get("/api/admin/allergenes", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const r = await pool.query(`SELECT allergene_id, libelle FROM allergene ORDER BY libelle`);
  res.json(r.rows);
});

app.post("/api/admin/allergenes", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const { libelle } = req.body || {};
  if (!libelle) return res.status(400).json({ error: "Missing libelle" });
  const ins = await pool.query(
    `INSERT INTO allergene (libelle) VALUES ($1) ON CONFLICT (libelle) DO NOTHING RETURNING allergene_id`,
    [String(libelle).trim()]
  );
  res.status(201).json({ id: ins.rows[0]?.allergene_id || null });
});

app.post("/api/admin/plats", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  try {
    const { nom, type, description, allergenes } = req.body || {};
    if (!nom || !type) return res.status(400).json({ error: "Missing fields" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ins = await client.query(
        `INSERT INTO plat (nom, type, description) VALUES ($1,$2,$3) RETURNING plat_id`,
        [nom, type, description || null]
      );

      const labels = Array.isArray(allergenes) ? allergenes : [];
      for (const label of labels) {
        const cleaned = String(label || "").trim();
        if (!cleaned) continue;
        await client.query(
          `INSERT INTO allergene (libelle) VALUES ($1) ON CONFLICT (libelle) DO NOTHING`,
          [cleaned]
        );
        const a = await client.query(`SELECT allergene_id FROM allergene WHERE libelle=$1`, [cleaned]);
        await client.query(
          `INSERT INTO plat_allergene (plat_id, allergene_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [ins.rows[0].plat_id, a.rows[0].allergene_id]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ id: ins.rows[0].plat_id });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/admin/plats/:id", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = await pool.query(`SELECT * FROM plat WHERE plat_id=$1`, [id]);
    if (cur.rowCount === 0) return res.status(404).json({ error: "Plat not found" });

    const { nom, type, description, allergenes } = req.body || {};
    await pool.query(
      `UPDATE plat SET nom=$1, type=$2, description=$3 WHERE plat_id=$4`,
      [
        nom ?? cur.rows[0].nom,
        type ?? cur.rows[0].type,
        description ?? cur.rows[0].description,
        id
      ]
    );

    if (Array.isArray(allergenes)) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM plat_allergene WHERE plat_id=$1`, [id]);
        for (const label of allergenes) {
          const cleaned = String(label || "").trim();
          if (!cleaned) continue;
          await client.query(
            `INSERT INTO allergene (libelle) VALUES ($1) ON CONFLICT (libelle) DO NOTHING`,
            [cleaned]
          );
          const a = await client.query(`SELECT allergene_id FROM allergene WHERE libelle=$1`, [cleaned]);
          await client.query(
            `INSERT INTO plat_allergene (plat_id, allergene_id)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [id, a.rows[0].allergene_id]
          );
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/admin/plats/:id", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const id = Number(req.params.id);
  const r = await pool.query(`DELETE FROM plat WHERE plat_id=$1 RETURNING plat_id`, [id]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Plat not found" });
  res.json({ ok: true });
});

// -------- HORAIRES --------
app.get("/api/horaires", async (req, res) => {
  const r = await pool.query(`SELECT jour, heure_ouverture, heure_fermeture FROM horaire ORDER BY horaire_id`);
  res.json(r.rows);
});

app.patch("/api/admin/horaires", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const h of items) {
      if (!h.jour) continue;
      await client.query(
        `INSERT INTO horaire (jour, heure_ouverture, heure_fermeture)
         VALUES ($1,$2,$3)
         ON CONFLICT (jour) DO UPDATE
         SET heure_ouverture=$2, heure_fermeture=$3, updated_at=NOW()`,
        [h.jour, h.heure_ouverture || null, h.heure_fermeture || null]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// -------- ORDERS USER --------
app.post("/api/orders/quote", requireAuth, async (req, res) => {
  try {
    const { menuId, persons, ville, distanceKm } = req.body || {};
    if (!menuId || !persons || !ville) return res.status(400).json({ error: "Missing fields" });

    const m = await pool.query(
      `SELECT menu_id, nombre_personne_minimum, prix_par_personne, is_active, stock_disponible
       FROM menu WHERE menu_id=$1`,
      [Number(menuId)]
    );
    if (m.rowCount === 0) return res.status(404).json({ error: "Menu not found" });
    if (!m.rows[0].is_active) return res.status(400).json({ error: "Menu inactive" });
    if (m.rows[0].stock_disponible != null && Number(m.rows[0].stock_disponible) <= 0) {
      return res.status(400).json({ error: "Menu out of stock" });
    }

    const p = computePricing(
      { pricePerPerson: m.rows[0].prix_par_personne, minPersons: m.rows[0].nombre_personne_minimum },
      persons, ville, distanceKm
    );

    res.json({ pricing: p });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/orders", requireAuth, async (req, res) => {
  const {
    menuId, persons, datePrestation, heureLivraison,
    adresse, ville, codePostal, distanceKm, materielPret=false
  } = req.body || {};

  if (!menuId || !persons || !datePrestation || !adresse || !ville) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const u = await client.query(
      `SELECT utilisateur_id, prenom, nom, email, telephone
       FROM utilisateur WHERE utilisateur_id=$1`,
      [String(req.user.id)]
    );
    if (u.rowCount === 0) throw new Error("user not found");

    const m = await client.query(
      `SELECT menu_id, titre, nombre_personne_minimum, prix_par_personne, is_active, stock_disponible
       FROM menu WHERE menu_id=$1
       FOR UPDATE`,
      [Number(menuId)]
    );
    if (m.rowCount === 0) return res.status(404).json({ error: "Menu not found" });
    if (!m.rows[0].is_active) return res.status(400).json({ error: "Menu inactive" });
    if (m.rows[0].stock_disponible != null && Number(m.rows[0].stock_disponible) <= 0) {
      return res.status(400).json({ error: "Menu out of stock" });
    }

    const pricing = computePricing(
      { pricePerPerson: m.rows[0].prix_par_personne, minPersons: m.rows[0].nombre_personne_minimum },
      persons, ville, distanceKm
    );

    let deadline = null;
    if (materielPret === true) deadline = addDaysIso(10);

    const numero = generateOrderNumber();
    const user = u.rows[0];

    await client.query(
      `INSERT INTO commande (
        numero_commande, utilisateur_id, menu_id,
        client_prenom, client_nom, client_email, client_telephone,
        adresse_prestation, ville_prestation, code_postal_prestation,
        date_prestation, heure_livraison,
        nombre_personnes,
        prix_par_personne_applique, prix_menu_brut, reduction_pourcent, reduction_eur, prix_menu_net,
        livraison_distance_km, prix_livraison, prix_total,
        materiel_pret, materiel_deadline, statut_courant
      ) VALUES (
        $1,$2,$3,
        $4,$5,$6,$7,
        $8,$9,$10,
        $11,$12,
        $13,
        $14,$15,$16,$17,$18,
        $19,$20,$21,
        $22,$23,'en_attente'
      )`,
      [
        numero, String(req.user.id), Number(menuId),
        user.prenom, user.nom, user.email, user.telephone || null,
        adresse, ville, codePostal || null,
        datePrestation, heureLivraison || null,
        Number(persons),
        m.rows[0].prix_par_personne, pricing.brut, pricing.reductionPercent, pricing.reductionEur, pricing.net,
        pricing.km, pricing.delivery, pricing.total,
        Boolean(materielPret), deadline
      ]
    );

    if (m.rows[0].stock_disponible != null) {
      await client.query(
        `UPDATE menu SET stock_disponible = stock_disponible - 1 WHERE menu_id=$1`,
        [Number(menuId)]
      );
    }

    await client.query(
      `INSERT INTO commande_statut_historique (numero_commande, statut, changed_by)
       VALUES ($1,'en_attente',$2)`,
      [numero, String(req.user.id)]
    );

    await client.query("COMMIT");
    await logEmail({
      to: user.email,
      subject: "Confirmation de commande",
      body: `Votre commande ${numero} est bien enregistrée.`,
      kind: "order_confirmation",
      relatedId: numero
    });
    await tryInsertOrderToMongo({
      numero_commande: numero,
      menu_id: m.rows[0].menu_id,
      menu_title: m.rows[0].titre,
      utilisateur_id: String(req.user.id),
      prix_total: pricing.total,
      date_prestation: datePrestation,
      created_at: new Date()
    });
    res.status(201).json({ numero_commande: numero, pricing });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.get("/api/orders/me", requireAuth, async (req, res) => {
  const r = await pool.query(
    `SELECT numero_commande, menu_id, statut_courant, prix_total, created_at,
            EXISTS (SELECT 1 FROM avis a WHERE a.numero_commande=commande.numero_commande) AS has_avis
     FROM commande
     WHERE utilisateur_id=$1
     ORDER BY created_at DESC`,
    [String(req.user.id)]
  );
  res.json(r.rows);
});

app.get("/api/orders/:numero", requireAuth, async (req, res) => {
  const numero = String(req.params.numero || "");
  const c = await pool.query(
    `SELECT * FROM commande WHERE numero_commande=$1 AND utilisateur_id=$2`,
    [numero, String(req.user.id)]
  );
  if (c.rowCount === 0) return res.status(404).json({ error: "Order not found" });

  const h = await pool.query(
    `SELECT statut, changed_at, changed_by, commentaire
     FROM commande_statut_historique
     WHERE numero_commande=$1
     ORDER BY changed_at ASC`,
    [numero]
  );

  res.json({ commande: c.rows[0], historique: h.rows });
});

app.patch("/api/orders/:numero", requireAuth, async (req, res) => {
  const numero = String(req.params.numero || "");
  if (!numero) return res.status(400).json({ error: "Missing numero" });

  const {
    persons, datePrestation, heureLivraison,
    adresse, ville, codePostal, distanceKm, materielPret
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cur = await client.query(
      `SELECT * FROM commande
       WHERE numero_commande=$1 AND utilisateur_id=$2
       FOR UPDATE`,
      [numero, String(req.user.id)]
    );
    if (cur.rowCount === 0) throw new Error("Order not found");
    const o = cur.rows[0];
    if (o.statut_courant !== "en_attente") throw new Error("Order cannot be modified");

    const m = await client.query(
      `SELECT menu_id, nombre_personne_minimum, prix_par_personne, is_active
       FROM menu WHERE menu_id=$1`,
      [o.menu_id]
    );
    if (m.rowCount === 0) throw new Error("Menu not found");
    if (!m.rows[0].is_active) throw new Error("Menu inactive");

    const nextPersons = persons != null ? Number(persons) : o.nombre_personnes;
    const nextVille = ville != null ? String(ville) : o.ville_prestation;
    const nextDistance = distanceKm != null ? Number(distanceKm) : o.livraison_distance_km;

    const pricing = computePricing(
      { pricePerPerson: m.rows[0].prix_par_personne, minPersons: m.rows[0].nombre_personne_minimum },
      nextPersons, nextVille, nextDistance
    );

    const nextMaterielPret = materielPret != null ? Boolean(materielPret) : o.materiel_pret;
    let deadline = o.materiel_deadline;
    let restitue = o.materiel_restitue;
    let penalite = o.materiel_penalite_appliquee;
    if (nextMaterielPret && !o.materiel_pret) {
      deadline = addDaysIso(10);
    }
    if (!nextMaterielPret) {
      deadline = null;
      restitue = false;
      penalite = false;
    }

    await client.query(
      `UPDATE commande SET
         adresse_prestation=$1,
         ville_prestation=$2,
         code_postal_prestation=$3,
         date_prestation=$4,
         heure_livraison=$5,
         nombre_personnes=$6,
         prix_par_personne_applique=$7,
         prix_menu_brut=$8,
         reduction_pourcent=$9,
         reduction_eur=$10,
         prix_menu_net=$11,
         livraison_distance_km=$12,
         prix_livraison=$13,
         prix_total=$14,
         materiel_pret=$15,
         materiel_deadline=$16,
         materiel_restitue=$17,
         materiel_penalite_appliquee=$18,
         updated_at=NOW()
       WHERE numero_commande=$19`,
      [
        adresse != null ? adresse : o.adresse_prestation,
        nextVille,
        codePostal != null ? codePostal : o.code_postal_prestation,
        datePrestation != null ? datePrestation : o.date_prestation,
        heureLivraison != null ? heureLivraison : o.heure_livraison,
        nextPersons,
        m.rows[0].prix_par_personne,
        pricing.brut,
        pricing.reductionPercent,
        pricing.reductionEur,
        pricing.net,
        pricing.km,
        pricing.delivery,
        pricing.total,
        nextMaterielPret,
        deadline,
        restitue,
        penalite,
        numero
      ]
    );

    await client.query(
      `INSERT INTO commande_statut_historique (numero_commande, statut, changed_by, commentaire)
       VALUES ($1,'en_attente',$2,$3)`,
      [numero, String(req.user.id), "Modification commande client"]
    );

    await client.query("COMMIT");
    res.json({ ok: true, pricing });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post("/api/orders/:numero/cancel", requireAuth, async (req, res) => {
  const numero = String(req.params.numero || "");
  const motif = String(req.body?.motif || "").trim() || "Annulation client";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cur = await client.query(
      `SELECT statut_courant, menu_id FROM commande
       WHERE numero_commande=$1 AND utilisateur_id=$2
       FOR UPDATE`,
      [numero, String(req.user.id)]
    );
    if (cur.rowCount === 0) throw new Error("Order not found");
    if (cur.rows[0].statut_courant !== "en_attente") throw new Error("Order cannot be cancelled");

    await client.query(
      `INSERT INTO commande_annulation (numero_commande, cancelled_by, mode, motif)
       VALUES ($1,$2,'email',$3)`,
      [numero, String(req.user.id), motif]
    );

    await client.query(
      `UPDATE commande SET statut_courant='annulee', updated_at=NOW() WHERE numero_commande=$1`,
      [numero]
    );

    await client.query(
      `UPDATE menu SET stock_disponible = stock_disponible + 1
       WHERE menu_id=$1 AND stock_disponible IS NOT NULL`,
      [cur.rows[0].menu_id]
    );

    await client.query(
      `INSERT INTO commande_statut_historique (numero_commande, statut, changed_by, commentaire)
       VALUES ($1,'annulee',$2,$3)`,
      [numero, String(req.user.id), `Annulation client : ${motif}`]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// -------- AVIS --------
app.post("/api/avis", requireAuth, async (req, res) => {
  try {
    const { numero_commande, note, commentaire } = req.body || {};
    if (!numero_commande || !note) return res.status(400).json({ error: "Missing fields" });

    const n = Number(note);
    if (!Number.isFinite(n) || n < 1 || n > 5) return res.status(400).json({ error: "Invalid note" });

    const c = await pool.query(
      `SELECT numero_commande, statut_courant FROM commande
       WHERE numero_commande=$1 AND utilisateur_id=$2`,
      [String(numero_commande), String(req.user.id)]
    );
    if (c.rowCount === 0) return res.status(404).json({ error: "Order not found" });
    if (c.rows[0].statut_courant !== "terminee") return res.status(400).json({ error: "Order not finished" });

    const existing = await pool.query(
      `SELECT avis_id FROM avis WHERE numero_commande=$1`,
      [String(numero_commande)]
    );
    if (existing.rowCount > 0) return res.status(409).json({ error: "Avis already exists" });

    const ins = await pool.query(
      `INSERT INTO avis (numero_commande, utilisateur_id, note, commentaire)
       VALUES ($1,$2,$3,$4) RETURNING avis_id`,
      [String(numero_commande), String(req.user.id), n, commentaire || null]
    );
    res.status(201).json({ avis_id: ins.rows[0].avis_id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/avis/public", async (req, res) => {
  const r = await pool.query(
    `SELECT a.avis_id, a.note, a.commentaire, a.created_at,
            u.prenom, u.nom
     FROM avis a
     JOIN utilisateur u ON u.utilisateur_id=a.utilisateur_id
     WHERE a.statut='approved'
     ORDER BY a.created_at DESC
     LIMIT 12`
  );
  const mapped = r.rows.map(row => ({
    avis_id: row.avis_id,
    note: row.note,
    commentaire: row.commentaire,
    created_at: row.created_at,
    author: `${row.prenom} ${String(row.nom || "").slice(0,1)}.`
  }));
  res.json(mapped);
});

// -------- CONTACT --------
app.post("/api/contact", async (req, res) => {
  try {
    const { email, titre, description } = req.body || {};
    if (!email || !titre || !description) return res.status(400).json({ error: "Missing fields" });

    await pool.query(
      `INSERT INTO contact_message (email, titre, description)
       VALUES ($1,$2,$3)`,
      [String(email).toLowerCase(), String(titre), String(description)]
    );

    await logEmail({
      to: "contact@viteetgourmand.fr",
      subject: `Nouveau contact: ${titre}`,
      body: `De: ${email}\n\n${description}`,
      kind: "contact",
      relatedId: String(email).toLowerCase()
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// -------- EMPLOYEES (ADMIN) --------
app.get("/api/admin/employees", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const r = await pool.query(
    `SELECT u.utilisateur_id, u.email, u.prenom, u.nom, u.telephone, u.is_active
     FROM utilisateur u
     JOIN roles r ON r.role_id=u.role_id
     WHERE r.libelle='EMPLOYE'
     ORDER BY u.created_at DESC`
  );
  res.json(r.rows);
});

app.post("/api/admin/employees", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { email, firstName, lastName, phone, password } = req.body || {};
    if (!email || !firstName || !lastName || !password) return res.status(400).json({ error: "Missing fields" });
    if (!isStrongPassword(password)) return res.status(400).json({ error: "Weak password" });

    const r = await pool.query("SELECT role_id FROM roles WHERE libelle='EMPLOYE'");
    if (r.rowCount === 0) return res.status(400).json({ error: "Role EMPLOYE missing" });

    const hash = await bcrypt.hash(String(password), 10);

    const ins = await pool.query(
      `INSERT INTO utilisateur (role_id, email, password_hash, prenom, nom, telephone)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING utilisateur_id`,
      [r.rows[0].role_id, String(email).toLowerCase(), hash, firstName, lastName, phone || null]
    );

    await logEmail({
      to: String(email).toLowerCase(),
      subject: "Création de compte employé",
      body: "Un compte employé a été créé. Merci de contacter l'administrateur pour le mot de passe.",
      kind: "employee_created",
      relatedId: ins.rows[0].utilisateur_id
    });

    res.status(201).json({ ok: true });
  } catch (e) {
    if (String(e.message).includes("duplicate")) return res.status(409).json({ error: "Email already used" });
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/admin/employees/:id/disable", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const id = String(req.params.id || "");
  const isActive = req.body?.isActive === undefined ? false : Boolean(req.body.isActive);

  const r = await pool.query(
    `UPDATE utilisateur u
     SET is_active=$1, updated_at=NOW()
     FROM roles r
     WHERE u.role_id=r.role_id AND r.libelle='EMPLOYE' AND u.utilisateur_id=$2
     RETURNING u.utilisateur_id, u.email, u.is_active`,
    [isActive, id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "Employee not found" });
  res.json(r.rows[0]);
});

// -------- AUTH: SET PASSWORD (invite/reset) --------
app.post("/api/auth/set-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: "Missing fields" });
    if (!isStrongPassword(password)) return res.status(400).json({ error: "Weak password" });

    const t = await pool.query(
      `SELECT id, utilisateur_id FROM password_reset
       WHERE token=$1 AND expires_at > NOW()`,
      [String(token)]
    );
    if (t.rowCount === 0) return res.status(400).json({ error: "Invalid or expired token" });

    const hash = await bcrypt.hash(String(password), 10);
    await pool.query(
      `UPDATE utilisateur SET password_hash=$1, updated_at=NOW() WHERE utilisateur_id=$2`,
      [hash, t.rows[0].utilisateur_id]
    );
    await pool.query(`DELETE FROM password_reset WHERE id=$1`, [t.rows[0].id]);

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// -------- AVIS (ADMIN/EMPLOYE) --------
app.get("/api/admin/avis", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const statut = req.query.statut ? String(req.query.statut) : "pending";
  assertAvisStatut(statut);

  const r = await pool.query(
    `SELECT a.avis_id, a.note, a.commentaire, a.statut, a.created_at,
            c.numero_commande, u.email, u.prenom, u.nom
     FROM avis a
     JOIN commande c ON c.numero_commande=a.numero_commande
     JOIN utilisateur u ON u.utilisateur_id=a.utilisateur_id
     WHERE a.statut=$1
     ORDER BY a.created_at DESC`,
    [statut]
  );
  res.json(r.rows);
});

app.patch("/api/admin/avis/:id", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const id = String(req.params.id || "");
  const statut = String(req.body?.statut || "");
  const moderationComment = String(req.body?.commentaire || "").trim() || null;
  if (!id || !statut) return res.status(400).json({ error: "Missing fields" });
  assertAvisStatut(statut);

  const r = await pool.query(
    `UPDATE avis
     SET statut=$1::avis_statut, moderation_comment=$2, moderated_by=$3, moderated_at=NOW()
     WHERE avis_id=$4
     RETURNING avis_id, statut`,
    [statut, moderationComment, String(req.user.id), id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "Avis not found" });
  res.json(r.rows[0]);
});

// -------- STATS (ADMIN) --------
app.get("/api/admin/stats/menus", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const db = await getMongoDb();
    if (db) {
      const menuId = req.query.menuId ? Number(req.query.menuId) : null;
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;

      const match = {};
      if (Number.isFinite(menuId)) match.menu_id = menuId;
      if (from || to) {
        match.created_at = {};
        if (from) match.created_at.$gte = from;
        if (to) match.created_at.$lte = to;
      }

      const rows = await db.collection("orders").aggregate([
        { $match: match },
        { $group: {
            _id: { menu_id: "$menu_id", menu_title: "$menu_title" },
            count: { $sum: 1 },
            total: { $sum: "$prix_total" }
        }},
        { $sort: { count: -1 } }
      ]).toArray();
      return res.json({
        source: "mongo",
        rows: rows.map(r => ({
          menu_id: r._id.menu_id,
          menu_title: r._id.menu_title,
          count: r.count,
          total: r.total
        }))
      });
    }
  } catch (e) {
    console.warn("Mongo stats failed:", e.message);
  }

  const menuId = req.query.menuId ? Number(req.query.menuId) : null;
  const from = req.query.from ? String(req.query.from) : null;
  const to = req.query.to ? String(req.query.to) : null;

  const r = await pool.query(
    `SELECT m.menu_id, m.titre AS menu_title,
            COUNT(c.numero_commande) AS count,
            COALESCE(SUM(c.prix_total),0) AS total
     FROM menu m
     LEFT JOIN commande c ON c.menu_id=m.menu_id
     WHERE ($1::int IS NULL OR m.menu_id=$1)
       AND ($2::date IS NULL OR c.created_at::date >= $2::date)
       AND ($3::date IS NULL OR c.created_at::date <= $3::date)
     GROUP BY m.menu_id, m.titre
     ORDER BY count DESC`,
    [Number.isFinite(menuId) ? menuId : null, from, to]
  );
  res.json({ source: "postgres", rows: r.rows });
});

// -------- ADMIN/EMPLOYE WORKFLOW --------
app.get("/api/admin/orders", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const statut = req.query.statut ? String(req.query.statut) : null;
  const q = req.query.q ? String(req.query.q) : null;

  if (statut) assertStatut(statut);

  const r = await pool.query(
    `SELECT numero_commande, client_email, client_nom, client_prenom, ville_prestation,
            date_prestation, heure_livraison, prix_total, statut_courant, created_at
     FROM commande
     WHERE ($1::commande_statut IS NULL OR statut_courant=$1::commande_statut)
       AND ($2::text IS NULL OR client_email ILIKE '%'||$2||'%' OR numero_commande ILIKE '%'||$2||'%')
     ORDER BY created_at DESC`,
    [statut, q]
  );
  res.json(r.rows);
});

app.get("/api/admin/orders/:numero", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const numero = String(req.params.numero || "");
  const c = await pool.query(`SELECT * FROM commande WHERE numero_commande=$1`, [numero]);
  if (c.rowCount === 0) return res.status(404).json({ error: "Order not found" });
  const h = await pool.query(
    `SELECT statut, changed_at, changed_by, commentaire
     FROM commande_statut_historique
     WHERE numero_commande=$1
     ORDER BY changed_at ASC`,
    [numero]
  );
  res.json({ commande: c.rows[0], historique: h.rows });
});

app.patch("/api/admin/orders/:numero/status", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const numero = String(req.params.numero || "");
  const next = String(req.body?.statut || "");
  const commentaire = String(req.body?.commentaire || "").trim() || null;

  if (!numero || !next) return res.status(400).json({ error: "Missing fields" });
  assertStatut(next);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cur = await client.query(
      `SELECT statut_courant, materiel_pret, materiel_restitue, materiel_deadline, client_email
       FROM commande
       WHERE numero_commande=$1
       FOR UPDATE`,
      [numero]
    );
    if (cur.rowCount === 0) throw new Error("Order not found");

    const o = cur.rows[0];

    if (o.statut_courant === "terminee" || o.statut_courant === "annulee") {
      throw new Error("Order closed");
    }

    assertTransition(o.statut_courant, next);

    if (next === "attente_retour_materiel" && o.materiel_pret !== true) {
      throw new Error("materiel_pret=false");
    }
    if (next === "terminee" && o.materiel_pret === true && o.materiel_restitue !== true) {
      throw new Error("Material not returned yet");
    }

    let deadline = o.materiel_deadline;
    if (next === "attente_retour_materiel" && !deadline) {
      const d = new Date();
      d.setDate(d.getDate() + 10);
      deadline = d.toISOString().slice(0,10);
    }

    await client.query(
      `UPDATE commande
       SET statut_courant=$1::commande_statut, updated_at=NOW(), materiel_deadline=COALESCE($3,materiel_deadline)
       WHERE numero_commande=$2`,
      [next, numero, deadline]
    );

    await client.query(
      `INSERT INTO commande_statut_historique (numero_commande, statut, changed_by, commentaire)
       VALUES ($1, $2::commande_statut, $3, $4)`,
      [numero, next, String(req.user.id), commentaire]
    );

    await client.query("COMMIT");
    if (next === "attente_retour_materiel") {
      await logEmail({
        to: o.client_email,
        subject: "Retour du matériel",
        body: "Merci de restituer le matériel sous 10 jours ouvrés pour éviter la pénalité.",
        kind: "material_return",
        relatedId: numero
      });
    }
    if (next === "terminee") {
      await logEmail({
        to: o.client_email,
        subject: "Commande terminée",
        body: "Votre commande est terminée. Vous pouvez laisser un avis dans votre espace.",
        kind: "order_done",
        relatedId: numero
      });
    }
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post("/api/admin/orders/:numero/cancel", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const numero = String(req.params.numero || "");
  const mc = String(req.body?.modeContact || "").toLowerCase();
  const motif = String(req.body?.motif || "").trim();

  if (!numero) return res.status(400).json({ error: "Missing numero" });
  if (!["gsm","email"].includes(mc)) return res.status(400).json({ error: "modeContact must be gsm or email" });
  if (!motif) return res.status(400).json({ error: "motif required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cur = await client.query(
      `SELECT statut_courant, menu_id FROM commande WHERE numero_commande=$1 FOR UPDATE`,
      [numero]
    );
    if (cur.rowCount === 0) throw new Error("Order not found");

    const status = cur.rows[0].statut_courant;
    if (status === "terminee" || status === "annulee") throw new Error("Order closed");

    await client.query(
      `INSERT INTO commande_annulation (numero_commande, cancelled_by, mode, motif)
       VALUES ($1,$2,$3::mode_contact,$4)`,
      [numero, String(req.user.id), mc, motif]
    );

    await client.query(
      `UPDATE commande SET statut_courant='annulee', updated_at=NOW() WHERE numero_commande=$1`,
      [numero]
    );

    await client.query(
      `UPDATE menu SET stock_disponible = stock_disponible + 1
       WHERE menu_id=$1 AND stock_disponible IS NOT NULL`,
      [cur.rows[0].menu_id]
    );

    await client.query(
      `INSERT INTO commande_statut_historique (numero_commande, statut, changed_by, commentaire)
       VALUES ($1,'annulee',$2,$3)`,
      [numero, String(req.user.id), `Annulation (${mc}) : ${motif}`]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.patch("/api/admin/orders/:numero/material-returned", requireAuth, requireRole("ADMIN","EMPLOYE"), async (req, res) => {
  const numero = String(req.params.numero || "");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cur = await client.query(
      `SELECT statut_courant, materiel_pret, materiel_deadline, client_email
       FROM commande
       WHERE numero_commande=$1
       FOR UPDATE`,
      [numero]
    );
    if (cur.rowCount === 0) throw new Error("Order not found");

    const o = cur.rows[0];
    if (o.materiel_pret !== true) throw new Error("No material loan");
    if (o.statut_courant !== "attente_retour_materiel") throw new Error("Not waiting material return");

    let penalite = false;
    if (o.materiel_deadline) {
      const today = new Date(); today.setHours(0,0,0,0);
      const dl = new Date(o.materiel_deadline); dl.setHours(0,0,0,0);
      if (today > dl) penalite = true;
    }

    await client.query(
      `UPDATE commande
       SET materiel_restitue=true,
           materiel_penalite_appliquee=$2,
           statut_courant='terminee',
           updated_at=NOW()
       WHERE numero_commande=$1`,
      [numero, penalite]
    );

    await client.query(
      `INSERT INTO commande_statut_historique (numero_commande, statut, changed_by, commentaire)
       VALUES ($1,'terminee',$2,$3)`,
      [numero, String(req.user.id), penalite ? "Terminee (penalite appliquee)" : "Terminee (materiel restitue)"]
    );

    await client.query("COMMIT");
    await logEmail({
      to: o.client_email,
      subject: "Commande terminée",
      body: "Votre commande est terminée. Vous pouvez laisser un avis dans votre espace.",
      kind: "order_done",
      relatedId: numero
    });
    res.json({ ok: true, penalite_appliquee: penalite });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://127.0.0.1:${PORT}`);
});
