import { requireAuth, getToken } from "./security.js";

const API_BASE = "https://vite-gourmand-api-3d14e45c9fc8.herokuapp.com/api";

if (!requireAuth("login.html")) {
  throw new Error("Not authenticated");
}

const ordersList = document.getElementById("ordersList");
const ordersMsg = document.getElementById("ordersMsg");
const orderDetail = document.getElementById("orderDetail");

const orderEditForm = document.getElementById("orderEditForm");
const editMsg = document.getElementById("editMsg");

const profileForm = document.getElementById("profileForm");
const profileMsg = document.getElementById("profileMsg");

const reviewForm = document.getElementById("reviewForm");
const reviewMsg = document.getElementById("reviewMsg");
const reviewHint = document.getElementById("reviewHint");

let orders = [];

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

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + getToken()
  };
}

function renderOrders(list) {
  if (!ordersList) return;
  if (!list || list.length === 0) {
    ordersList.innerHTML = `<div class="text-muted">Aucune commande.</div>`;
    return;
  }

  const rows = list.map((o) => {
    const canEdit = o.statut_courant === "en_attente";
    const canReview = o.statut_courant === "terminee" && !o.has_avis;
    return `
      <tr>
        <td>${o.numero_commande}</td>
        <td>${o.statut_courant}</td>
        <td>${Number(o.prix_total).toFixed(2)} €</td>
        <td>${new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
        <td class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" data-action="view" data-num="${o.numero_commande}">Voir</button>
          ${canEdit ? `<button class="btn btn-sm btn-outline-primary" data-action="edit" data-num="${o.numero_commande}">Modifier</button>` : ""}
          ${canEdit ? `<button class="btn btn-sm btn-outline-danger" data-action="cancel" data-num="${o.numero_commande}">Annuler</button>` : ""}
          ${canReview ? `<button class="btn btn-sm btn-outline-success" data-action="review" data-num="${o.numero_commande}">Avis</button>` : ""}
        </td>
      </tr>
    `;
  }).join("");

  ordersList.innerHTML = `
    <table class="table table-sm">
      <thead>
        <tr>
          <th>Numéro</th>
          <th>Statut</th>
          <th>Total</th>
          <th>Créée</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  ordersList.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const numero = btn.getAttribute("data-num");
      handleAction(action, numero);
    });
  });
}

async function loadOrders() {
  try {
    hideMsg(ordersMsg);
    const r = await fetch(`${API_BASE}/orders/me`, { headers: authHeaders() });
    const data = await r.json().catch(() => ([]));
    if (!r.ok) throw new Error(data.error || "Erreur chargement");
    orders = data;
    renderOrders(orders);
  } catch (e) {
    showMsg(ordersMsg, "danger", e.message);
  }
}

async function loadOrderDetail(numero, showForm = false) {
  try {
    const r = await fetch(`${API_BASE}/orders/${numero}`, { headers: authHeaders() });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Commande introuvable");

    const c = data.commande;
    const histo = data.historique || [];
    orderDetail.innerHTML = `
      <div><strong>Commande:</strong> ${c.numero_commande}</div>
      <div><strong>Statut:</strong> ${c.statut_courant}</div>
      <div><strong>Adresse:</strong> ${c.adresse_prestation}, ${c.ville_prestation}</div>
      <div><strong>Date:</strong> ${c.date_prestation}</div>
      <div><strong>Personnes:</strong> ${c.nombre_personnes}</div>
      <div><strong>Total:</strong> ${Number(c.prix_total).toFixed(2)} €</div>
      <div class="mt-2"><strong>Historique:</strong></div>
      <ul class="small">
        ${histo.map((h) => `<li>${h.statut} — ${new Date(h.changed_at).toLocaleString("fr-FR")}</li>`).join("")}
      </ul>
    `;

    if (showForm && c.statut_courant === "en_attente") {
      orderEditForm.classList.remove("d-none");
      document.getElementById("editNumero").value = c.numero_commande;
      document.getElementById("editPersons").value = c.nombre_personnes;
      document.getElementById("editDate").value = c.date_prestation;
      document.getElementById("editHeure").value = c.heure_livraison || "";
      document.getElementById("editAdresse").value = c.adresse_prestation;
      document.getElementById("editVille").value = c.ville_prestation;
      document.getElementById("editCP").value = c.code_postal_prestation || "";
      document.getElementById("editDistance").value = Number(c.livraison_distance_km || 0);
      document.getElementById("editMateriel").checked = Boolean(c.materiel_pret);
      hideMsg(editMsg);
    } else {
      orderEditForm.classList.add("d-none");
    }
  } catch (e) {
    showMsg(ordersMsg, "danger", e.message);
  }
}

async function loadProfile() {
  try {
    const r = await fetch(`${API_BASE}/users/me`, { headers: authHeaders() });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Erreur profil");
    document.getElementById("profileFirstName").value = data.prenom || "";
    document.getElementById("profileLastName").value = data.nom || "";
    document.getElementById("profilePhone").value = data.telephone || "";
    document.getElementById("profileAddress").value = data.adresse || "";
  } catch (e) {
    showMsg(profileMsg, "danger", e.message);
  }
}

if (profileForm) {
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      firstName: document.getElementById("profileFirstName").value.trim(),
      lastName: document.getElementById("profileLastName").value.trim(),
      phone: document.getElementById("profilePhone").value.trim(),
      address: document.getElementById("profileAddress").value.trim()
    };
    try {
      const r = await fetch(`${API_BASE}/users/me`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erreur mise à jour");
      showMsg(profileMsg, "success", "Informations mises à jour.");
    } catch (e) {
      showMsg(profileMsg, "danger", e.message);
    }
  });
}

async function handleAction(action, numero) {
  if (action === "view") {
    await loadOrderDetail(numero, false);
    return;
  }
  if (action === "edit") {
    await loadOrderDetail(numero, true);
    return;
  }
  if (action === "cancel") {
    const motif = prompt("Motif d’annulation ?");
    if (!motif) return;
    try {
      const r = await fetch(`${API_BASE}/orders/${numero}/cancel`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ motif })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Annulation impossible");
      showMsg(ordersMsg, "success", "Commande annulée.");
      await loadOrders();
    } catch (e) {
      showMsg(ordersMsg, "danger", e.message);
    }
    return;
  }
  if (action === "review") {
    reviewForm.classList.remove("d-none");
    reviewHint.classList.add("d-none");
    document.getElementById("reviewNumero").value = numero;
    hideMsg(reviewMsg);
  }
}

if (orderEditForm) {
  orderEditForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const numero = document.getElementById("editNumero").value;
    const payload = {
      persons: Number(document.getElementById("editPersons").value),
      datePrestation: document.getElementById("editDate").value,
      heureLivraison: document.getElementById("editHeure").value || null,
      adresse: document.getElementById("editAdresse").value,
      ville: document.getElementById("editVille").value,
      codePostal: document.getElementById("editCP").value || null,
      distanceKm: Number(document.getElementById("editDistance").value || 0),
      materielPret: document.getElementById("editMateriel").checked
    };

    try {
      const r = await fetch(`${API_BASE}/orders/${numero}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Modification impossible");
      showMsg(editMsg, "success", "Commande mise à jour.");
      await loadOrders();
      await loadOrderDetail(numero, true);
    } catch (e) {
      showMsg(editMsg, "danger", e.message);
    }
  });
}

if (reviewForm) {
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const numero = document.getElementById("reviewNumero").value;
    const payload = {
      numero_commande: numero,
      note: Number(document.getElementById("reviewNote").value),
      commentaire: document.getElementById("reviewComment").value.trim()
    };
    try {
      const r = await fetch(`${API_BASE}/avis`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Avis non envoyé");
      showMsg(reviewMsg, "success", "Merci pour votre avis !");
      reviewForm.classList.add("d-none");
      reviewHint.classList.remove("d-none");
      await loadOrders();
    } catch (e) {
      showMsg(reviewMsg, "danger", e.message);
    }
  });
}

loadOrders();
loadProfile();
