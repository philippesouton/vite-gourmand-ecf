const API_BASE = "http://127.0.0.1:3001/api";

const form = document.getElementById("contactForm");
const msg = document.getElementById("contactMsg");

function show(type, text) {
  if (!msg) return;
  msg.className = `alert alert-${type}`;
  msg.textContent = text;
  msg.classList.remove("d-none");
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    show("secondary", "Envoi en cours...");

    const payload = {
      email: document.getElementById("contactEmail").value.trim(),
      titre: document.getElementById("contactTitle").value.trim(),
      description: document.getElementById("contactMessage").value.trim()
    };

    try {
      const r = await fetch(`${API_BASE}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Erreur d’envoi");
      show("success", "Message envoyé. Merci !");
      form.reset();
    } catch (err) {
      show("danger", err.message);
    }
  });
}
