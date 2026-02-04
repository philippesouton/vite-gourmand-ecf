import { requireRoles, getToken, getRole, logout } from "./security.js";

const API_BASE = "http://127.0.0.1:3001/api";

requireRoles(["ADMIN", "EMPLOYE"], "login.html");

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.classList.remove("d-none");
  logoutBtn.addEventListener("click", () => logout("login.html"));
}

const profileMsg = document.getElementById("profileMsg");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileRole = document.getElementById("profileRole");
const profilePhone = document.getElementById("profilePhone");

function showMsg(type, text) {
  if (!profileMsg) return;
  profileMsg.className = `alert alert-${type}`;
  profileMsg.textContent = text;
  profileMsg.classList.remove("d-none");
}

async function loadProfile() {
  try {
    const r = await fetch(`${API_BASE}/users/me`, {
      headers: {
        "Authorization": "Bearer " + getToken()
      }
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Erreur profil");

    profileName.textContent = `${data.prenom || ""} ${data.nom || ""}`.trim();
    profileEmail.textContent = data.email || "-";
    profileRole.textContent = getRole() || "-";
    profilePhone.textContent = data.telephone || "-";
  } catch (e) {
    showMsg("danger", e.message);
  }
}

loadProfile();
