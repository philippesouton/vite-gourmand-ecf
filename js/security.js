// js/security.js

export function getToken() {
  return localStorage.getItem("token");
}

export function getRole() {
  return localStorage.getItem("role");
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function hasAnyRole(roles) {
  const role = getRole();
  return role != null && roles.includes(role);
}

export function logout(redirectTo = "login.html") {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = redirectTo;
}

// Optionnel mais utile : décoder payload JWT (sans vérification crypto)
export function getJwtPayload(token) {
  try {
    const payloadPart = token.split(".")[1];
    const json = atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = getJwtPayload(token);
  if (!payload || !payload.exp) return false; // si inconnu, on ne bloque pas
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSec;
}

export function requireAuth(redirectTo = "login.html") {
  const token = getToken();
  if (!token) {
    window.location.href = redirectTo;
    return false;
  }
  if (isTokenExpired(token)) {
    logout(redirectTo);
    return false;
  }
  return true;
}

export function requireRoles(roles, redirectTo = "login.html") {
  if (!requireAuth(redirectTo)) return false;
  if (!hasAnyRole(roles)) {
    // page dédiée “forbidden” serait mieux, mais simple:
    window.location.href = "index.html";
    return false;
  }
  return true;
}
