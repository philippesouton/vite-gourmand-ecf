import { requireRoles, getToken, logout } from "./security.js";

const API_BASE = "http://127.0.0.1:3001/api";

requireRoles(["ADMIN", "EMPLOYE"], "login.html");

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.classList.remove("d-none");
  logoutBtn.addEventListener("click", () => logout("login.html"));
}

const filterStatus = document.getElementById("filterStatus");
const filterQuery = document.getElementById("filterQuery");
const filterBtn = document.getElementById("filterBtn");
const ordersList = document.getElementById("ordersList");
const ordersMsg = document.getElementById("ordersMsg");

const STATUSES = [
  "en_attente",
  "accepte",
  "en_preparation",
  "en_livraison",
  "livre",
  "attente_retour_materiel",
  "terminee",
  "annulee"
];

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + getToken()
  };
}

function showMsg(type, text) {
  if (!ordersMsg) return;
  ordersMsg.className = `alert alert-${type}`;
  ordersMsg.textContent = text;
  ordersMsg.classList.remove("d-none");
}

async function loadOrders() {
  const statut = filterStatus.value;
  const q = filterQuery.value.trim();
  const url = new URL(`${API_BASE}/admin/orders`);
  if (statut) url.searchParams.set("statut", statut);
  if (q) url.searchParams.set("q", q);

  const r = await fetch(url.toString(), { headers: authHeaders() });
  const data = await r.json().catch(() => ([]));
  if (!r.ok) {
    ordersList.textContent = "Erreur chargement.";
    return;
  }
  if (data.length === 0) {
    ordersList.textContent = "Aucune commande.";
    return;
  }

  ordersList.innerHTML = `
    <table class="table table-sm align-middle">
      <thead>
        <tr>
          <th>Numéro</th>
          <th>Client</th>
          <th>Date</th>
          <th>Statut</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((o) => `
          <tr>
            <td>${o.numero_commande}</td>
            <td>${o.client_email}</td>
            <td>${new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
            <td>
              <select class="form-select form-select-sm" data-status="${o.numero_commande}">
                ${STATUSES.map((s) => `<option value="${s}" ${s === o.statut_courant ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </td>
            <td class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary" data-action="update" data-num="${o.numero_commande}">Mettre à jour</button>
              <button class="btn btn-sm btn-outline-danger" data-action="cancel" data-num="${o.numero_commande}">Annuler</button>
              <button class="btn btn-sm btn-outline-success" data-action="returned" data-num="${o.numero_commande}">Matériel rendu</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  ordersList.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-action");
      const numero = btn.getAttribute("data-num");
      if (action === "update") return updateStatus(numero);
      if (action === "cancel") return cancelOrder(numero);
      if (action === "returned") return materialReturned(numero);
    });
  });
}

async function updateStatus(numero) {
  const select = document.querySelector(`select[data-status="${numero}"]`);
  const statut = select ? select.value : null;
  try {
    const r = await fetch(`${API_BASE}/admin/orders/${numero}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ statut })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Erreur");
    showMsg("success", "Statut mis à jour.");
    loadOrders();
  } catch (e) {
    showMsg("danger", e.message);
  }
}

async function cancelOrder(numero) {
  const modeContact = String(prompt("Mode de contact (gsm/email) ?") || "").toLowerCase();
  if (!modeContact) return;
  if (!["gsm", "email"].includes(modeContact)) {
    showMsg("danger", "Mode de contact invalide.");
    return;
  }
  const motif = prompt("Motif d’annulation ?");
  if (!motif) return;
  try {
    const r = await fetch(`${API_BASE}/admin/orders/${numero}/cancel`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ modeContact, motif })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Erreur");
    showMsg("success", "Commande annulée.");
    loadOrders();
  } catch (e) {
    showMsg("danger", e.message);
  }
}

async function materialReturned(numero) {
  try {
    const r = await fetch(`${API_BASE}/admin/orders/${numero}/material-returned`, {
      method: "PATCH",
      headers: authHeaders()
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Erreur");
    showMsg("success", "Matériel restitué.");
    loadOrders();
  } catch (e) {
    showMsg("danger", e.message);
  }
}

if (filterBtn) filterBtn.addEventListener("click", loadOrders);

loadOrders();
