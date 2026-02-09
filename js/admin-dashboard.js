import { requireRoles, getRole, getToken, logout } from "./security.js";

const API_BASE = "https://vite-gourmand-api-3d14e45c9fc8.herokuapp.com/api";

if (!requireRoles(["ADMIN", "EMPLOYE"], "login.html")) {
  throw new Error("Not authorized");
}

const role = getRole();
const adminOnly = document.getElementById("adminOnly");
const statsSection = document.getElementById("statsSection");
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.classList.remove("d-none");
  logoutBtn.addEventListener("click", () => logout("login.html"));
}

if (role === "ADMIN") {
  adminOnly.classList.remove("d-none");
  statsSection.classList.remove("d-none");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + getToken()
  };
}

function showMsg(el, type, text) {
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = text;
  el.classList.remove("d-none");
}

function hideMsg(el) {
  if (!el) return;
  el.classList.add("d-none");
}

// -------- Employés (ADMIN) --------
const employeeForm = document.getElementById("employeeForm");
const employeeMsg = document.getElementById("employeeMsg");
const employeeList = document.getElementById("employeeList");

async function loadEmployees() {
  if (role !== "ADMIN") return;
  const r = await fetch(`${API_BASE}/admin/employees`, { headers: authHeaders() });
  const data = await r.json().catch(() => ([]));
  if (!r.ok) {
    employeeList.textContent = "Erreur chargement.";
    return;
  }
  if (data.length === 0) {
    employeeList.textContent = "Aucun employé.";
    return;
  }
  employeeList.innerHTML = `
    <table class="table table-sm">
      <thead><tr><th>Nom</th><th>Email</th><th>Actif</th><th></th></tr></thead>
      <tbody>
        ${data.map((u) => `
          <tr>
            <td>${u.prenom} ${u.nom}</td>
            <td>${u.email}</td>
            <td>${u.is_active ? "Oui" : "Non"}</td>
            <td>
              <button class="btn btn-sm btn-outline-${u.is_active ? "danger" : "success"}"
                data-action="toggle" data-id="${u.utilisateur_id}" data-active="${u.is_active}">
                ${u.is_active ? "Désactiver" : "Activer"}
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  employeeList.querySelectorAll("button[data-action='toggle']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const isActive = btn.getAttribute("data-active") !== "true";
      await toggleEmployee(id, isActive);
    });
  });
}

async function toggleEmployee(id, isActive) {
  try {
    const r = await fetch(`${API_BASE}/admin/employees/${id}/disable`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ isActive })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Erreur");
    showMsg(employeeMsg, "success", "Statut mis à jour.");
    await loadEmployees();
  } catch (e) {
    showMsg(employeeMsg, "danger", e.message);
  }
}

if (employeeForm) {
  employeeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMsg(employeeMsg);

    const payload = {
      email: document.getElementById("empEmail").value.trim(),
      firstName: document.getElementById("empFirstName").value.trim(),
      lastName: document.getElementById("empLastName").value.trim(),
      phone: document.getElementById("empPhone").value.trim(),
      password: document.getElementById("empPassword").value
    };

    try {
      const r = await fetch(`${API_BASE}/admin/employees`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erreur création");
      showMsg(employeeMsg, "success", "Employé créé. Mot de passe à communiquer en privé.");
      employeeForm.reset();
      await loadEmployees();
    } catch (e) {
      showMsg(employeeMsg, "danger", e.message);
    }
  });
}

// -------- Avis (ADMIN/EMPLOYE) --------
const avisList = document.getElementById("avisList");
const avisMsg = document.getElementById("avisMsg");

async function loadAvis() {
  const r = await fetch(`${API_BASE}/admin/avis?statut=pending`, { headers: authHeaders() });
  const data = await r.json().catch(() => ([]));
  if (!r.ok) {
    avisList.textContent = "Erreur chargement.";
    return;
  }
  if (data.length === 0) {
    avisList.textContent = "Aucun avis en attente.";
    return;
  }
  avisList.innerHTML = `
    <table class="table table-sm">
      <thead><tr><th>Client</th><th>Note</th><th>Commentaire</th><th></th></tr></thead>
      <tbody>
        ${data.map((a) => `
          <tr>
            <td>${a.prenom} ${a.nom}</td>
            <td>${a.note}</td>
            <td>${a.commentaire || ""}</td>
            <td class="d-flex gap-2">
              <button class="btn btn-sm btn-success" data-action="approve" data-id="${a.avis_id}">Valider</button>
              <button class="btn btn-sm btn-danger" data-action="reject" data-id="${a.avis_id}">Refuser</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  avisList.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      const commentaire = action === "reject" ? prompt("Motif du refus ?") : "";
      const statut = action === "approve" ? "approved" : "rejected";
      await updateAvis(id, statut, commentaire);
    });
  });
}

async function updateAvis(id, statut, commentaire) {
  try {
    const r = await fetch(`${API_BASE}/admin/avis/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ statut, commentaire })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Erreur modération");
    showMsg(avisMsg, "success", "Avis mis à jour.");
    await loadAvis();
  } catch (e) {
    showMsg(avisMsg, "danger", e.message);
  }
}

// -------- Stats (ADMIN) --------
const statsList = document.getElementById("statsList");
const statsSource = document.getElementById("statsSource");
const statsMenu = document.getElementById("statsMenu");
const statsFrom = document.getElementById("statsFrom");
const statsTo = document.getElementById("statsTo");
const statsFilterBtn = document.getElementById("statsFilterBtn");

async function loadStats() {
  if (role !== "ADMIN") return;
  const url = new URL(`${API_BASE}/admin/stats/menus`);
  if (statsMenu && statsMenu.value) url.searchParams.set("menuId", statsMenu.value);
  if (statsFrom && statsFrom.value) url.searchParams.set("from", statsFrom.value);
  if (statsTo && statsTo.value) url.searchParams.set("to", statsTo.value);

  const r = await fetch(url.toString(), { headers: authHeaders() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    statsList.textContent = "Erreur chargement.";
    return;
  }
  statsSource.textContent = `Source: ${data.source}`;
  const rows = data.rows || [];
  if (rows.length === 0) {
    statsList.textContent = "Aucune donnée.";
    return;
  }
  const max = Math.max(...rows.map((r) => Number(r.count)));
  statsList.innerHTML = rows.map((r) => `
    <div class="mb-2">
      <div class="d-flex justify-content-between">
        <span>${r.menu_title}</span>
        <span>${r.count} commandes • ${Number(r.total).toFixed(2)} €</span>
      </div>
      <div class="bar" style="width:${max ? (Number(r.count) / max) * 100 : 0}%"></div>
    </div>
  `).join("");
}

async function loadMenuOptions() {
  if (role !== "ADMIN") return;
  const r = await fetch(`${API_BASE}/menus`);
  const data = await r.json().catch(() => ([]));
  if (!r.ok) return;
  if (!statsMenu) return;
  data.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.title;
    statsMenu.appendChild(opt);
  });
}

if (statsFilterBtn) statsFilterBtn.addEventListener("click", loadStats);

loadEmployees();
loadAvis();
loadMenuOptions();
loadStats();
