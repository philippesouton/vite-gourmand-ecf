import { isAuthenticated, hasAnyRole, logout, getRole, getToken, isTokenExpired } from "./security.js";

const adminLink = document.getElementById("adminLink");
const logoutBtn = document.getElementById("logoutBtn");

// Si token expiré, on logout silencieux
const token = getToken();
if (token && isTokenExpired(token)) {
  logout("login.html");
}

if (isAuthenticated()) {
  if (logoutBtn) logoutBtn.classList.remove("d-none");
  if (logoutBtn) logoutBtn.addEventListener("click", () => logout());

  if (adminLink && hasAnyRole(["ADMIN", "EMPLOYEE"])) {
    adminLink.classList.remove("d-none");
  }
} else {
  // non connecté: on peut laisser adminLink caché
  if (adminLink) adminLink.classList.add("d-none");
  if (logoutBtn) logoutBtn.classList.add("d-none");
}
