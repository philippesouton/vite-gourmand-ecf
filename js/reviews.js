const API_BASE = "https://vite-gourmand-api-eu-a88d7f2d4f7f.herokuapp.com/api";

const reviewsList = document.getElementById("reviewsList");

function stars(n) {
  return "⭐".repeat(Math.max(1, Math.min(5, Number(n))));
}

function renderReviews(list) {
  if (!reviewsList) return;
  if (!list || list.length === 0) return;

  reviewsList.innerHTML = "";
  list.forEach((r) => {
    const col = document.createElement("div");
    col.className = "col-md-6";
    col.innerHTML = `
      <article class="card mb-3 p-3">
        <p><strong>${r.author}</strong> – ${stars(r.note)}</p>
        <p>${r.commentaire || ""}</p>
      </article>
    `;
    reviewsList.appendChild(col);
  });
}

async function loadReviews() {
  try {
    const r = await fetch(`${API_BASE}/avis/public`);
    if (!r.ok) return;
    const data = await r.json();
    renderReviews(data);
  } catch {
    // silencieux
  }
}

loadReviews();
