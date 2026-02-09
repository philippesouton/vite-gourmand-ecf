const API_BASE = "https://vite-gourmand-api-3d14e45c9fc8.herokuapp.com/api";

let menus = [];
let currentMenu = null;

const filterTheme = document.getElementById("filterTheme");
const filterDiet = document.getElementById("filterDiet");
const filterMinPersons = document.getElementById("filterMinPersons");
const filterMaxPrice = document.getElementById("filterMaxPrice");
const filterMinPrice = document.getElementById("filterMinPrice");
const resetFilters = document.getElementById("resetFilters");

const menusSection = document.getElementById("menusSection");
const menusContainer = document.getElementById("menusContainer");
const homeContent = document.getElementById("homeContent");
const popularMenus = document.getElementById("popularMenus");
const galleryGrid = document.getElementById("galleryGrid");

const menuDetail = document.getElementById("menuDetail");
const detailTitle = document.getElementById("detailTitle");
const detailDescription = document.getElementById("detailDescription");
const detailInfos = document.getElementById("detailInfos");
const detailConditions = document.getElementById("detailConditions");
const detailGallery = document.getElementById("detailGallery");
const detailPlats = document.getElementById("detailPlats");
const backToList = document.getElementById("backToList");

const orderBtn = document.getElementById("orderBtn");

function showList() {
  if (homeContent) homeContent.classList.remove("d-none");
  if (menuDetail) menuDetail.classList.add("d-none");
}

function showDetail() {
  if (homeContent) homeContent.classList.add("d-none");
  if (menuDetail) menuDetail.classList.remove("d-none");
}

function getMenuPriceMin(menu) {
  return Number(menu.priceMin ?? (menu.pricePerPerson * menu.minPersons));
}

function renderPlats(plats) {
  if (!detailPlats) return;
  if (!plats || plats.length === 0) {
    detailPlats.textContent = "Aucun plat.";
    return;
  }

  detailPlats.innerHTML = "";
  plats.forEach((p) => {
    const line = document.createElement("div");
    const allergenes = p.allergenes && p.allergenes.length
      ? `Allergènes: ${p.allergenes.map((a) => a.libelle).join(", ")}`
      : "Allergènes: aucun";
    line.className = "mb-2";
    line.innerHTML = `
      <div><strong>${p.type.toUpperCase()}</strong> — ${p.nom}</div>
      <div class="text-muted small">${p.description || ""}</div>
      <div class="text-muted small">${allergenes}</div>
    `;
    detailPlats.appendChild(line);
  });
}

function renderGallery(images) {
  if (!detailGallery) return;
  detailGallery.innerHTML = "";
  if (!images || images.length === 0) return;
  images.forEach((img) => {
    const col = document.createElement("div");
    col.className = "col-6 col-md-4";
    col.innerHTML = `<img class="img-fluid rounded-3" src="${img.url}" alt="${img.alt || "Menu"}">`;
    detailGallery.appendChild(col);
  });
}

function renderDetail(payload) {
  const menu = payload.menu;
  currentMenu = menu;
  const menuPriceMin = getMenuPriceMin(menu);

  detailTitle.textContent = menu.title;
  detailDescription.textContent = menu.description;

  detailInfos.innerHTML = `
    <li class="list-group-item"><strong>Thème :</strong> ${menu.theme || "Standard"}</li>
    <li class="list-group-item"><strong>Régime :</strong> ${menu.regime || "Classique"}</li>
    <li class="list-group-item"><strong>Minimum :</strong> ${menu.minPersons} personnes</li>
    <li class="list-group-item"><strong>Prix :</strong> ${menuPriceMin.toFixed(2)} €</li>
    <li class="list-group-item"><strong>Stock :</strong> ${menu.stock == null ? "Non renseigné" : menu.stock}</li>
  `;

  if (menu.conditions) {
    detailConditions.textContent = `Conditions: ${menu.conditions}`;
    detailConditions.classList.remove("d-none");
  } else {
    detailConditions.classList.add("d-none");
  }

  renderGallery(payload.images);
  renderPlats(payload.plats);
  showDetail();
}

async function loadMenuDetail(id) {
  const r = await fetch(`${API_BASE}/menus/${id}`);
  if (!r.ok) throw new Error("Menu introuvable");
  const payload = await r.json();
  renderDetail(payload);
}

function renderMenus(list) {
  if (!menusContainer) return;

  if (!list || list.length === 0) {
    menusContainer.innerHTML = `<div class="alert alert-info">Aucun menu pour le moment.</div>`;
    return;
  }

  menusContainer.innerHTML = "";

  for (const menu of list) {
    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-lg-4";
    const images = Array.isArray(menu.images) ? menu.images : [];
    const mainImg = images[0];
    const carouselId = `menuCarousel-${menu.id}`;
    const imgHtml = mainImg
      ? (
          images.length > 1
            ? `
              <div class="menu-media">
                <div id="${carouselId}" class="carousel slide" data-bs-ride="carousel" data-bs-interval="4000">
                  <div class="carousel-inner rounded-3">
                  ${images.map((img, idx) => `
                    <div class="carousel-item ${idx === 0 ? "active" : ""}">
                      <img src="${img.url}" alt="${img.alt || menu.title}"
                           class="d-block w-100">
                    </div>
                  `).join("")}
                  </div>
                  <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev" aria-label="Précédent">
                    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                  </button>
                  <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next" aria-label="Suivant">
                    <span class="carousel-control-next-icon" aria-hidden="true"></span>
                  </button>
                </div>
              </div>
            `
            : `
              <div class="menu-media">
                <img src="${mainImg.url}" alt="${mainImg.alt || menu.title}"
                     class="img-fluid rounded-3">
              </div>
            `
        )
      : "";
    col.innerHTML = `
      <div class="card h-100 p-3 menu-card">
        ${imgHtml}
        <div class="menu-tags">
          ${menu.theme ? `<span class="badge">${menu.theme}</span>` : ""}
          ${menu.regime ? `<span class="badge">${menu.regime}</span>` : ""}
        </div>
        <h3 class="h5 mb-1">${menu.title}</h3>
        <p class="text-muted mb-2">${menu.description}</p>
        <div class="menu-meta mb-2">
          <span><strong>Minimum :</strong> ${menu.minPersons} pers.</span>
          <span><strong>Prix :</strong> ${getMenuPriceMin(menu).toFixed(2)} €</span>
        </div>
        <button class="btn btn-outline-dark btn-sm" data-menu-id="${menu.id}">
          Voir le détail
        </button>
      </div>
    `;
    menusContainer.appendChild(col);
  }

  menusContainer.querySelectorAll("button[data-menu-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-menu-id"));
      try {
        await loadMenuDetail(id);
      } catch (e) {
        console.error(e);
      }
    });
  });
}

function renderPopularMenus(list) {
  if (!popularMenus) return;
  if (!list || list.length === 0) {
    popularMenus.innerHTML = `<div class="text-muted">Aucun menu populaire.</div>`;
    return;
  }
  const canOpenDetail = Boolean(menuDetail);
  const topMenus = list.slice(0, 3);
  popularMenus.innerHTML = "";
  topMenus.forEach((menu) => {
    const col = document.createElement("div");
    col.className = "col-12 col-md-4";
    const images = Array.isArray(menu.images) ? menu.images : [];
    const mainImg = images[0];
    const imgHtml = mainImg
      ? `<div class="menu-media mb-2"><img src="${mainImg.url}" alt="${mainImg.alt || menu.title}" class="img-fluid rounded-3"></div>`
      : "";
    col.innerHTML = `
      <div class="card h-100 p-3 menu-card">
        ${imgHtml}
        <h3 class="h6 mb-1">${menu.title}</h3>
        <div class="menu-meta mb-2">À partir de ${getMenuPriceMin(menu).toFixed(2)} €</div>
        ${canOpenDetail
          ? `<button class="btn btn-outline-dark btn-sm" data-menu-id="${menu.id}">Voir</button>`
          : `<a class="btn btn-outline-dark btn-sm" href="menus.html?menuId=${menu.id}">Voir</a>`
        }
      </div>
    `;
    popularMenus.appendChild(col);
  });

  if (canOpenDetail) {
    popularMenus.querySelectorAll("button[data-menu-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-menu-id"));
        try {
          await loadMenuDetail(id);
        } catch (e) {
          console.error(e);
        }
      });
    });
  }
}

function renderGallery(list) {
  if (!galleryGrid) return;
  galleryGrid.innerHTML = "";
  const images = list
    .flatMap((m) => (Array.isArray(m.images) ? m.images : []))
    .filter((img) => img && img.url);

  if (images.length === 0) {
    galleryGrid.innerHTML = `<div class="text-muted">Aucune image disponible.</div>`;
    return;
  }

  images.slice(0, 8).forEach((img) => {
    const col = document.createElement("div");
    col.className = "col-6 col-md-3";
    col.innerHTML = `<img src="${img.url}" alt="${img.alt || "Menu"}" class="img-fluid">`;
    galleryGrid.appendChild(col);
  });
}

async function loadMenus() {
  try {
    if (menusContainer) {
      menusContainer.innerHTML = `<div class="alert alert-secondary">Chargement des menus...</div>`;
    }

    const r = await fetch(`${API_BASE}/menus`);
    if (!r.ok) throw new Error("Erreur lors du chargement des menus");

    menus = await r.json();
    menus = menus.map((m) => ({
      ...m,
      images: typeof m.images === "string" ? JSON.parse(m.images) : m.images
    }));
    fillSelect(filterTheme, uniqueSorted(menus.map((m) => m.theme).filter(Boolean)));
    fillSelect(filterDiet, uniqueSorted(menus.map((m) => m.regime).filter(Boolean)));
    wireFilters();
    renderGallery(menus);
    renderPopularMenus(menus);
    renderMenus(menus);
    showList();
    const queryMenuId = getQueryMenuId();
    if (queryMenuId && detailTitle) {
      loadMenuDetail(queryMenuId).catch(() => {});
    }
  } catch (err) {
    console.error(err);
    if (menusContainer) {
      menusContainer.innerHTML = `<div class="alert alert-danger">Impossible de charger les menus.</div>`;
    }
  }
}

function getQueryMenuId() {
  const params = new URLSearchParams(window.location.search);
  const val = params.get("menuId");
  return val ? Number(val) : null;
}

if (backToList) {
  backToList.addEventListener("click", showList);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function fillSelect(selectEl, values) {
  if (!selectEl) return;
  selectEl.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  }
}

function applyFilters() {
  const themeVal = filterTheme ? filterTheme.value : "";
  const regimeVal = filterDiet ? filterDiet.value : "";

  const minPersonsVal = filterMinPersons && filterMinPersons.value !== ""
    ? Number(filterMinPersons.value)
    : null;

  const maxPriceVal = filterMaxPrice && filterMaxPrice.value !== ""
    ? Number(filterMaxPrice.value)
    : null;

  const minPriceVal = filterMinPrice && filterMinPrice.value !== ""
    ? Number(filterMinPrice.value)
    : null;

  const filtered = menus.filter((m) => {
    const menuPriceMin = Number(m.priceMin ?? (m.pricePerPerson * m.minPersons));
    if (themeVal && m.theme !== themeVal) return false;
    if (regimeVal && m.regime !== regimeVal) return false;
    // Filtre "nombre de personnes" = menus compatibles avec ce nombre
    if (minPersonsVal != null && m.minPersons > minPersonsVal) return false;
    if (maxPriceVal != null && menuPriceMin > maxPriceVal) return false;
    if (minPriceVal != null && menuPriceMin < minPriceVal) return false;
    return true;
  });

  renderMenus(filtered);
  showList();
}

function wireFilters() {
  if (filterTheme) filterTheme.addEventListener("change", applyFilters);
  if (filterDiet) filterDiet.addEventListener("change", applyFilters);
  if (filterMinPersons) filterMinPersons.addEventListener("input", applyFilters);
  if (filterMaxPrice) filterMaxPrice.addEventListener("input", applyFilters);
  if (filterMinPrice) filterMinPrice.addEventListener("input", applyFilters);

  if (resetFilters) {
    resetFilters.addEventListener("click", () => {
      if (filterTheme) filterTheme.value = "";
      if (filterDiet) filterDiet.value = "";
      if (filterMinPersons) filterMinPersons.value = "";
      if (filterMaxPrice) filterMaxPrice.value = "";
      if (filterMinPrice) filterMinPrice.value = "";
      renderMenus(menus);
      showList();
    });
  }
}

if (orderBtn) {
  orderBtn.addEventListener("click", () => {
    if (!currentMenu) return;
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "login.html";
      return;
    }
    window.location.href = `order.html?menuId=${currentMenu.id}`;
  });
}

loadMenus();
