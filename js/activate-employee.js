const API_BASE = "https://vite-gourmand-api-3d14e45c9fc8.herokuapp.com/api";

const form = document.getElementById("activateForm");
const msg = document.getElementById("activateMsg");

function show(type, text) {
  if (!msg) return;
  msg.className = `alert alert-${type}`;
  msg.textContent = text;
  msg.classList.remove("d-none");
}

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

const tokenField = document.getElementById("inviteToken");
const tokenFromUrl = getTokenFromUrl();
if (tokenField && tokenFromUrl) {
  tokenField.value = tokenFromUrl;
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    show("secondary", "Activation en cours...");

    const token = document.getElementById("inviteToken").value.trim();
    const password = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmPassword").value;

    if (!token || !password || !confirm) {
      show("danger", "Veuillez remplir tous les champs.");
      return;
    }
    if (password.length < 8) {
      show("danger", "Mot de passe trop court (8 caractères minimum).");
      return;
    }
    if (password !== confirm) {
      show("danger", "Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      const r = await fetch(`${API_BASE}/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Activation impossible");
      show("success", "Compte activé. Vous pouvez vous connecter.");
      form.reset();
    } catch (err) {
      show("danger", err.message);
    }
  });
}
