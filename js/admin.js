import { requireRoles, logout, getToken } from "./security.js";

const API_BASE = "http://127.0.0.1:3001/api";

console.log("admin.js chargé");

// Bloque immédiatement si pas ADMIN/EMPLOYEE (redirige login si non connecté, sinon index)
requireRoles(["ADMIN", "EMPLOYEE"], "login.html");

function showBox(id, type, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = text;
  el.classList.remove("d-none");
}

function hideBox(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("d-none");
}

// ----- Logout btn -----
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) logoutBtn.addEventListener("click", () => logout("login.html"));

// ----- Form submit -----
const menuForm = document.getElementById("menuForm");

if (menuForm) {
  menuForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBox("menuMsg");

    const payload = {
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      theme: document.getElementById("theme").value.trim(),
      diet: document.getElementById("diet").value.trim(),
      minPersons: Number(document.getElementById("minPersons").value),
      priceMin: Number(document.getElementById("priceMin").value),
      isActive: document.getElementById("isActive").checked ? 1 : 0,
    };

    if (!payload.title || !payload.description || !payload.theme || !payload.diet) {
      showBox("menuMsg", "danger", "Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (!Number.isFinite(payload.minPersons) || payload.minPersons < 1) {
      showBox("menuMsg", "danger", "Minimum personnes invalide.");
      return;
    }
    if (!Number.isFinite(payload.priceMin) || payload.priceMin < 0) {
      showBox("menuMsg", "danger", "Prix invalide.");
      return;
    }

    try {
      const r = await fetch(`${API_BASE}/menus`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + getToken(),
        },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erreur lors de la création");

      showBox("menuMsg", "success", `Menu créé (id: ${data.id}).`);
      menuForm.reset();
      document.getElementById("isActive").checked = true;

      // Si tu as ajouté la table admin :
      if (typeof loadAdminMenus === "function") {
        loadAdminMenus();
      }
    } catch (err) {
      showBox("menuMsg", "danger", err.message);
    }
  });
}
