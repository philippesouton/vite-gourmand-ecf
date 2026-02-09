import { getToken } from "./security.js";

const API_BASE = "https://vite-gourmand-api-3d14e45c9fc8.herokuapp.com/api";

const orderMsg = document.getElementById("orderMsg");
const form = document.getElementById("orderPageForm");
const menuSelect = document.getElementById("menuId");
const priceSummary = document.getElementById("priceSummary");

let menus = [];
const token = getToken();
const isAuthenticated = Boolean(token);

function showMsg(type, text) {
  if (!orderMsg) return;
  orderMsg.className = `alert alert-${type}`;
  orderMsg.textContent = text;
  orderMsg.classList.remove("d-none");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + getToken()
  };
}

function getQueryMenuId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("menuId");
}

async function loadUser() {
  const r = await fetch(`${API_BASE}/users/me`, { headers: authHeaders() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Erreur utilisateur");
  document.getElementById("clientFirstName").value = data.prenom || "";
  document.getElementById("clientLastName").value = data.nom || "";
  document.getElementById("clientEmail").value = data.email || "";
  document.getElementById("clientPhone").value = data.telephone || "";
  document.getElementById("adresse").value = data.adresse || "";
}

async function loadMenus() {
  const r = await fetch(`${API_BASE}/menus`);
  const data = await r.json().catch(() => ([]));
  if (!r.ok) throw new Error("Erreur chargement menus");
  menus = data;

  menuSelect.innerHTML = "";
  menus.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.title} (${Number(m.priceMin).toFixed(2)} €)`;
    menuSelect.appendChild(opt);
  });

  const qMenu = getQueryMenuId();
  if (qMenu) {
    menuSelect.value = qMenu;
  }
}

function getQuotePayload() {
  return {
    menuId: Number(menuSelect.value),
    persons: Number(document.getElementById("persons").value),
    ville: document.getElementById("ville").value.trim(),
    distanceKm: Number(document.getElementById("distanceKm").value || 0)
  };
}

async function refreshQuote() {
  const payload = getQuotePayload();
  if (!payload.menuId || !payload.persons || !payload.ville) {
    priceSummary.textContent = "Complétez le formulaire.";
    return;
  }
  try {
    const r = await fetch(`${API_BASE}/orders/quote`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Erreur devis");
    const p = data.pricing;
    priceSummary.innerHTML = `
      <div>Prix menu brut: ${p.brut.toFixed(2)} €</div>
      <div>Réduction: ${p.reductionPercent}% (-${p.reductionEur.toFixed(2)} €)</div>
      <div>Prix menu net: ${p.net.toFixed(2)} €</div>
      <div>Livraison: ${p.delivery.toFixed(2)} €</div>
      <div><strong>Total: ${p.total.toFixed(2)} €</strong></div>
    `;
  } catch (e) {
    priceSummary.textContent = e.message;
  }
}

["menuId", "persons", "ville", "distanceKm"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", refreshQuote);
});
if (menuSelect) menuSelect.addEventListener("change", refreshQuote);

if (!isAuthenticated) {
  showMsg("warning", "Merci de vous connecter ou de créer un compte pour commander.");
  if (form) {
    form.classList.add("d-none");
  }
  if (priceSummary) {
    priceSummary.classList.add("d-none");
  }
  const ctaWrap = document.createElement("div");
  ctaWrap.className = "d-flex flex-wrap gap-2 mt-2";

  const loginCta = document.createElement("a");
  loginCta.href = "login.html";
  loginCta.className = "btn btn-primary btn-sm";
  loginCta.textContent = "Se connecter";
  ctaWrap.appendChild(loginCta);

  const registerCta = document.createElement("a");
  registerCta.href = "register.html";
  registerCta.className = "btn btn-outline-primary btn-sm";
  registerCta.textContent = "Créer un compte";
  ctaWrap.appendChild(registerCta);

  if (orderMsg) orderMsg.appendChild(ctaWrap);
} else if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("secondary", "Envoi en cours...");

    const payload = {
      menuId: Number(menuSelect.value),
      persons: Number(document.getElementById("persons").value),
      datePrestation: document.getElementById("datePrestation").value,
      heureLivraison: document.getElementById("heureLivraison").value || null,
      adresse: document.getElementById("adresse").value.trim(),
      ville: document.getElementById("ville").value.trim(),
      codePostal: document.getElementById("codePostal").value.trim() || null,
      distanceKm: Number(document.getElementById("distanceKm").value || 0),
      materielPret: document.getElementById("materielPret").checked
    };

    try {
      const r = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Commande impossible");
      showMsg("success", `Commande enregistrée: ${data.numero_commande}`);
      form.reset();
    } catch (e) {
      showMsg("danger", e.message);
    }
  });
}

if (!isAuthenticated) {
  // Ne pas charger les données protégées si non connecté
  if (priceSummary) {
    priceSummary.textContent = "Connectez-vous pour voir le devis et valider la commande.";
  }
} else {
  loadUser().catch((e) => showMsg("danger", e.message));
  loadMenus()
    .then(refreshQuote)
    .catch((e) => showMsg("danger", e.message));
}
