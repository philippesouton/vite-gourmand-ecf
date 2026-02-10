const API_BASE = "https://vite-gourmand-api-eu-a88d7f2d4f7f.herokuapp.com/api";

const hoursText = document.getElementById("hoursText");

async function loadHours() {
  if (!hoursText) return;
  try {
    const r = await fetch(`${API_BASE}/horaires`);
    const data = await r.json().catch(() => ([]));
    if (!r.ok || data.length === 0) return;
    const lines = data.map((h) => {
      const open = h.heure_ouverture ? h.heure_ouverture.slice(0,5) : "Fermé";
      const close = h.heure_fermeture ? h.heure_fermeture.slice(0,5) : "";
      return `${h.jour} : ${open}${close ? " - " + close : ""}`;
    });
    hoursText.textContent = lines.join(" • ");
  } catch {
    // silencieux
  }
}

loadHours();
