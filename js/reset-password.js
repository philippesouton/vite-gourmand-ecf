const API_BASE = "https://vite-gourmand-api-eu-a88d7f2d4f7f.herokuapp.com/api";

const form = document.getElementById("resetForm");
const msg = document.getElementById("resetMsg");
const tokenField = document.getElementById("resetToken");

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

const tokenFromUrl = getTokenFromUrl();
if (tokenFromUrl && tokenField) {
  tokenField.value = tokenFromUrl;
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    show("secondary", "Traitement en cours...");

    const token = tokenField.value.trim();
    const password = document.getElementById("resetPassword").value;
    const confirm = document.getElementById("resetPasswordConfirm").value;

    if (!token || !password || !confirm) {
      show("danger", "Veuillez remplir tous les champs.");
      return;
    }
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(password);
    if (!strong) {
      show("danger", "Mot de passe trop faible (10+ caractères, majuscule, minuscule, chiffre, spécial).");
      return;
    }
    if (password !== confirm) {
      show("danger", "Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      const r = await fetch(`${API_BASE}/auth/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erreur");
      show("success", "Mot de passe mis à jour. Vous pouvez vous connecter.");
      form.reset();
    } catch (err) {
      show("danger", err.message);
    }
  });
}
