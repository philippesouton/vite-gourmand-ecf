const API_BASE = "http://127.0.0.1:3001/api";

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
