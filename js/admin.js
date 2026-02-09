import { requireRoles, logout, getToken } from "./security.js";

const API_BASE = "https://vite-gourmand-api-3d14e45c9fc8.herokuapp.com/api";

requireRoles(["ADMIN", "EMPLOYE"], "login.html");

const adminPanel = document.getElementById("adminPanel");
if (adminPanel) {
  adminPanel.classList.remove("d-none");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + getToken()
  };
}

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

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) logoutBtn.addEventListener("click", () => logout("login.html"));

// ---- Menus ----
const menuForm = document.getElementById("menuForm");
const menusTableBody = document.getElementById("menusTableBody");
const refreshMenus = document.getElementById("refreshMenus");
const galleryChoices = document.getElementById("galleryChoices");
const galleryTheme = document.getElementById("galleryTheme");
const gallerySearch = document.getElementById("gallerySearch");
const gallerySelectAll = document.getElementById("gallerySelectAll");
const galleryClearAll = document.getElementById("galleryClearAll");

let galleryItems = [];
const selectedGalleryImages = new Set();

async function loadMenus() {
  const r = await fetch(`${API_BASE}/admin/menus`, { headers: authHeaders() });
  const data = await r.json().catch(() => ([]));
  if (!r.ok) {
    showBox("menusTableMsg", "danger", "Erreur chargement menus");
    return;
  }
  menusTableBody.innerHTML = data.map((m) => `
    <tr>
      <td>${m.id}</td>
      <td>${m.title}</td>
      <td>${m.theme || "-"}</td>
      <td>${m.regime || "-"}</td>
      <td>${m.minPersons}</td>
      <td>${Number(m.pricePerPerson).toFixed(2)} €</td>
      <td>${m.stock == null ? "-" : m.stock}</td>
      <td>${m.isActive ? "Oui" : "Non"}</td>
      <td class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-secondary" data-action="toggle" data-id="${m.id}" data-active="${m.isActive}">
          ${m.isActive ? "Désactiver" : "Activer"}
        </button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${m.id}">
          Supprimer
        </button>
      </td>
    </tr>
  `).join("");

  menusTableBody.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (action === "toggle") {
        const isActive = btn.getAttribute("data-active") !== "true";
        await updateMenu(id, { isActive });
      }
      if (action === "delete") {
        await deleteMenu(id);
      }
    });
  });
}

async function updateMenu(id, payload) {
  const r = await fetch(`${API_BASE}/admin/menus/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    showBox("menusTableMsg", "danger", data.error || "Erreur");
    return;
  }
  showBox("menusTableMsg", "success", "Menu mis à jour.");
  loadMenus();
}

async function deleteMenu(id) {
  const r = await fetch(`${API_BASE}/admin/menus/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    showBox("menusTableMsg", "danger", data.error || "Erreur");
    return;
  }
  showBox("menusTableMsg", "success", "Menu supprimé (désactivé).");
  loadMenus();
}

if (refreshMenus) refreshMenus.addEventListener("click", loadMenus);

if (menuForm) {
  menuForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBox("menuMsg");

    const selectedImages = Array.from(selectedGalleryImages);

    const payload = {
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      theme: document.getElementById("theme").value.trim(),
      regime: document.getElementById("diet").value.trim(),
      minPersons: Number(document.getElementById("minPersons").value),
      pricePerPerson: Number(document.getElementById("priceMin").value),
      conditions: document.getElementById("conditions").value.trim(),
      stock: document.getElementById("stock").value !== "" ? Number(document.getElementById("stock").value) : null,
      isActive: document.getElementById("isActive").checked,
      images: selectedImages
    };

    if (!payload.title || !payload.description) {
      showBox("menuMsg", "danger", "Veuillez remplir les champs obligatoires.");
      return;
    }

    try {
      const r = await fetch(`${API_BASE}/admin/menus`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erreur lors de la création");
      showBox("menuMsg", "success", `Menu créé (id: ${data.id}).`);
      menuForm.reset();
      document.getElementById("isActive").checked = true;
      if (galleryChoices) {
        galleryChoices.querySelectorAll("input[type='checkbox']").forEach((cb) => {
          cb.checked = false;
        });
      }
      selectedGalleryImages.clear();
      loadMenus();
    } catch (err) {
      showBox("menuMsg", "danger", err.message);
    }
  });
}

// ---- Galerie menu ----
const menuImageForm = document.getElementById("menuImageForm");
if (menuImageForm) {
  menuImageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBox("imgMsg");
    const menuId = document.getElementById("imgMenuId").value.trim();
    const url = document.getElementById("imgUrl").value.trim();
    const alt = document.getElementById("imgAlt").value.trim();
    try {
      const r = await fetch(`${API_BASE}/admin/menus/${menuId}/images`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ url, alt })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erreur");
      showBox("imgMsg", "success", "Image ajoutée.");
      menuImageForm.reset();
    } catch (e) {
      showBox("imgMsg", "danger", e.message);
    }
  });
}

// ---- Plats ----
const platForm = document.getElementById("platForm");
const platList = document.getElementById("platList");

async function loadPlats() {
  const r = await fetch(`${API_BASE}/admin/plats`, { headers: authHeaders() });
  const data = await r.json().catch(() => ([]));
  if (!r.ok) {
    platList.textContent = "Erreur chargement plats.";
    return;
  }
  if (data.length === 0) {
    platList.textContent = "Aucun plat.";
    return;
  }
  platList.innerHTML = `
    <table class="table table-sm">
      <thead><tr><th>ID</th><th>Nom</th><th>Type</th><th>Allergènes</th><th></th></tr></thead>
      <tbody>
        ${data.map((p) => `
          <tr>
            <td>${p.plat_id}</td>
            <td>${p.nom}</td>
            <td>${p.type}</td>
            <td>${(p.allergenes || []).map((a) => a.libelle).join(", ")}</td>
            <td><button class="btn btn-sm btn-outline-danger" data-del="${p.plat_id}">Supprimer</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  platList.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      await deletePlat(id);
    });
  });
}

async function deletePlat(id) {
  const r = await fetch(`${API_BASE}/admin/plats/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    showBox("platMsg", "danger", data.error || "Erreur");
    return;
  }
  showBox("platMsg", "success", "Plat supprimé.");
  loadPlats();
}

if (platForm) {
  platForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBox("platMsg");
    const allergenes = document.getElementById("platAllergenes").value
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const payload = {
      nom: document.getElementById("platName").value.trim(),
      type: document.getElementById("platType").value,
      description: document.getElementById("platDesc").value.trim(),
      allergenes
    };

    try {
      const r = await fetch(`${API_BASE}/admin/plats`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erreur");
      showBox("platMsg", "success", "Plat créé.");
      platForm.reset();
      loadPlats();
    } catch (e) {
      showBox("platMsg", "danger", e.message);
    }
  });
}

// ---- Menu ↔ Plats ----
const menuPlatsForm = document.getElementById("menuPlatsForm");
if (menuPlatsForm) {
  menuPlatsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBox("menuPlatsMsg");
    const menuId = document.getElementById("menuPlatsMenuId").value.trim();
    const platIds = document.getElementById("menuPlatsIds").value
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v));

    try {
      const r = await fetch(`${API_BASE}/admin/menus/${menuId}/plats`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ platIds })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erreur");
      showBox("menuPlatsMsg", "success", "Associations mises à jour.");
    } catch (e) {
      showBox("menuPlatsMsg", "danger", e.message);
    }
  });
}

// ---- Horaires ----
const hoursForm = document.getElementById("hoursForm");
if (hoursForm) {
  hoursForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBox("hoursMsg");
    const jour = document.getElementById("hoursDay").value.trim();
    const heure_ouverture = document.getElementById("hoursOpen").value || null;
    const heure_fermeture = document.getElementById("hoursClose").value || null;

    try {
      const r = await fetch(`${API_BASE}/admin/horaires`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify([{ jour, heure_ouverture, heure_fermeture }])
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erreur");
      showBox("hoursMsg", "success", "Horaires mis à jour.");
      hoursForm.reset();
    } catch (e) {
      showBox("hoursMsg", "danger", e.message);
    }
  });
}

loadMenus();
loadPlats();

function extractThemeFromUrl(url) {
  const parts = String(url || "").split("/");
  const galleryIndex = parts.indexOf("gallery");
  const themePart = galleryIndex >= 0 && parts.length > galleryIndex + 1 ? parts[galleryIndex + 1] : "";
  if (themePart && !themePart.includes(".")) {
    return themePart.charAt(0).toUpperCase() + themePart.slice(1);
  }
  const file = parts.pop() || "";
  const name = file.replace(/\.[^/.]+$/, "");
  const normalized = name.replace(/[-_]+/g, " ").trim();
  const first = normalized.split(/\s+/)[0];
  if (!first) return "Autre";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function renderGalleryChoices() {
  if (!galleryChoices) return;
  const themeFilter = galleryTheme ? galleryTheme.value : "";
  const search = gallerySearch ? gallerySearch.value.trim().toLowerCase() : "";

  const filtered = galleryItems.filter((img) => {
    const theme = img.theme || "";
    if (themeFilter && theme !== themeFilter) return false;
    if (search && !img.label.toLowerCase().includes(search)) return false;
    return true;
  });

  if (filtered.length === 0) {
    galleryChoices.innerHTML = `<div class="text-muted">Aucune image pour ce filtre.</div>`;
    return;
  }

  galleryChoices.innerHTML = filtered.map((img) => `
    <div class="col-6 col-md-4 col-lg-3">
      <label class="border rounded-3 p-2 d-block h-100">
        <input type="checkbox" class="form-check-input me-2" value="${img.url}" ${selectedGalleryImages.has(img.url) ? "checked" : ""}>
        <img src="${img.url}" alt="${img.alt}" class="img-fluid rounded-2 mb-2" style="height:100px; object-fit:cover;">
        <div class="small text-muted">${img.label}</div>
      </label>
    </div>
  `).join("");

  galleryChoices.querySelectorAll("input[type='checkbox']").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) selectedGalleryImages.add(cb.value);
      else selectedGalleryImages.delete(cb.value);
    });
  });
}

async function loadGalleryChoices() {
  if (!galleryChoices) return;
  let data = [];
  try {
    const r = await fetch(`${API_BASE}/admin/gallery-images`, { headers: authHeaders() });
    data = await r.json().catch(() => ([]));
    if (!r.ok) {
      data = [];
    }
  } catch (e) {
    data = [];
  }

  if (!Array.isArray(data) || data.length === 0) {
    try {
      const r = await fetch("assets/gallery/gallery.json");
      data = await r.json().catch(() => ([]));
    } catch (e) {
      data = [];
    }
  }

  if (!Array.isArray(data) || data.length === 0) {
    galleryChoices.innerHTML = `<div class="text-muted">Aucune image trouvée.</div>`;
    return;
  }

  galleryItems = data.map((img) => {
    const theme = extractThemeFromUrl(img.url);
    return {
      ...img,
      theme,
      label: `${theme} • ${img.alt}`
    };
  });

  if (galleryTheme) {
    const themes = Array.from(new Set(galleryItems.map((i) => i.theme))).sort();
    galleryTheme.innerHTML = `<option value="">Tous les thèmes</option>` + themes.map((t) => `<option value="${t}">${t}</option>`).join("");
  }

  renderGalleryChoices();
}

loadGalleryChoices();

if (galleryTheme) galleryTheme.addEventListener("change", renderGalleryChoices);
if (gallerySearch) gallerySearch.addEventListener("input", renderGalleryChoices);
if (gallerySelectAll) gallerySelectAll.addEventListener("click", () => {
  galleryChoices.querySelectorAll("input[type='checkbox']").forEach((cb) => {
    cb.checked = true;
    selectedGalleryImages.add(cb.value);
  });
});
if (galleryClearAll) galleryClearAll.addEventListener("click", () => {
  galleryChoices.querySelectorAll("input[type='checkbox']").forEach((cb) => {
    cb.checked = false;
    selectedGalleryImages.delete(cb.value);
  });
});
