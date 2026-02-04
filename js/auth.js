const API_BASE = "http://127.0.0.1:3001/api";


function showMsg(id, type, text) {
  const box = document.getElementById(id);
  if (!box) return;
  box.className = `alert alert-${type}`;
  box.textContent = text;
  box.classList.remove("d-none");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(pw) {
  // 10+ chars, 1 lower, 1 upper, 1 digit, 1 special
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(pw);
}

/* -------------------------
   LOGIN
------------------------- */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      showMsg("loginMsg", "danger", "Veuillez renseigner l’email et le mot de passe.");
      return;
    }

    if (!isValidEmail(email)) {
      showMsg("loginMsg", "danger", "Format d’email invalide.");
      return;
    }

    fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Erreur de connexion");
        return data;
      })
      .then((data) => {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);
        showMsg("loginMsg", "success", `Connecté (rôle: ${data.role}).`);
        // Redirection simple selon rôle
        if (data.role === "ADMIN" || data.role === "EMPLOYE") {
          window.location.href = "admin-dashboard.html";
        } else {
          window.location.href = "index.html";
        }
      })
      .catch((err) => {
        showMsg("loginMsg", "danger", err.message);
      });
  });
}

/* -------------------------
   REGISTER
------------------------- */
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const address = document.getElementById("address").value.trim();
    const password = document.getElementById("password").value;
    const passwordConfirm = document.getElementById("passwordConfirm").value;

    if (!firstName || !lastName || !phone || !email || !address || !password || !passwordConfirm) {
      showMsg("registerMsg", "danger", "Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if (!isValidEmail(email)) {
      showMsg("registerMsg", "danger", "Format d’email invalide.");
      return;
    }

    if (password !== passwordConfirm) {
      showMsg("registerMsg", "danger", "Les mots de passe ne correspondent pas.");
      return;
    }

    if (!isStrongPassword(password)) {
      showMsg("registerMsg", "danger", "Mot de passe trop faible (voir les règles).");
      return;
    }

    fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        phone,
        email,
        address,
        password,
      }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Erreur d’inscription");
        return data;
      })
      .then(() => {
        showMsg("registerMsg", "success", "Compte créé. Vous pouvez vous connecter.");
        registerForm.reset();
      })
      .catch((err) => {
        showMsg("registerMsg", "danger", err.message);
      });
  });
}

/* -------------------------
   FORGOT PASSWORD
------------------------- */
const forgotForm = document.getElementById("forgotForm");

if (forgotForm) {
  forgotForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("forgotEmail").value.trim();

    if (!email) {
      showMsg("forgotMsg", "danger", "Veuillez saisir votre email.");
      return;
    }

    if (!isValidEmail(email)) {
      showMsg("forgotMsg", "danger", "Format d’email invalide.");
      return;
    }

  // Option A: simulation (OK pour ECF si tu expliques "email non envoyé en dev")
    fetch(`${API_BASE}/auth/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Erreur");
        return data;
      })
      .then(() => {
        showMsg("forgotMsg", "success", "Demande envoyée. Si un compte existe, vous recevrez un email.");
        forgotForm.reset();
      })
      .catch((err) => {
        showMsg("forgotMsg", "danger", err.message);
      });
  });
}
