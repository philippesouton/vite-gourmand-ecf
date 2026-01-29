const API_BASE = "http://127.0.0.1:3001/api";

let menus = [];

let currentMenu = null;

const filterTheme = document.getElementById("filterTheme");
const filterDiet = document.getElementById("filterDiet");
const filterMinPersons = document.getElementById("filterMinPersons");
const filterMaxPrice = document.getElementById("filterMaxPrice");
const resetFilters = document.getElementById("resetFilters");

const menusSection = document.getElementById("menusSection");
const menusContainer = document.getElementById("menusContainer");

const menuDetail = document.getElementById("menuDetail");
const detailTitle = document.getElementById("detailTitle");
const detailDescription = document.getElementById("detailDescription");
const detailInfos = document.getElementById("detailInfos");
const backToList = document.getElementById("backToList");

const orderBtn = document.getElementById("orderBtn");
const orderModalEl = document.getElementById("orderModal"); 
let orderModal = null;
if (orderModalEl) {
  orderModal = new bootstrap.Modal(orderModalEl);
}
if (orderBtn) {
 orderBtn.addEventListener("click", () => {
  if (!currentMenu) {
    console.error("Aucun menu sélectionné : ouvre d'abord un menu (Voir le détail).");
    return;
  }
  orderModal.show();
});
}



function showList() {
  if (menusSection) menusSection.classList.remove("d-none");
  if (menuDetail) menuDetail.classList.add("d-none");
}

function showDetail(menu) {
  if (!menuDetail) return;

currentMenu = menu;

  if (menusSection) menusSection.classList.add("d-none");
  menuDetail.classList.remove("d-none");

  detailTitle.textContent = menu.title;
  detailDescription.textContent = menu.description;

  detailInfos.innerHTML = `
    <li class="list-group-item"><strong>Thème :</strong> ${menu.theme}</li>
    <li class="list-group-item"><strong>Régime :</strong> ${menu.diet}</li>
    <li class="list-group-item"><strong>Minimum :</strong> ${menu.minPersons} personnes</li>
    <li class="list-group-item"><strong>Prix :</strong> ${menu.priceMin} €</li>
  `;
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

    col.innerHTML = `
      <div class="card h-100 p-3">
        <h3 class="h5">${menu.title}</h3>
        <p class="mb-2">${menu.description}</p>
        <p class="mb-1"><strong>Minimum :</strong> ${menu.minPersons} personnes</p>
        <p class="mb-3"><strong>Prix :</strong> ${menu.priceMin} €</p>
        <button class="btn btn-outline-dark btn-sm" data-menu-id="${menu.id}">
          Voir le détail
        </button>
      </div>
    `;

    menusContainer.appendChild(col);
  }

  // Brancher les boutons "Voir le détail"
  menusContainer.querySelectorAll("button[data-menu-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-menu-id"));
      const menu = menus.find((m) => m.id === id);
      if (menu) showDetail(menu);
    });
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
    fillSelect(filterTheme, uniqueSorted(menus.map((m) => m.theme)));
fillSelect(filterDiet, uniqueSorted(menus.map((m) => m.diet)));
wireFilters();
    renderMenus(menus);
    showList();
  } catch (err) {
    console.error(err);
    if (menusContainer) {
      menusContainer.innerHTML = `<div class="alert alert-danger">Impossible de charger les menus.</div>`;
    }
  }
}

if (backToList) {
  backToList.addEventListener("click", showList);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function fillSelect(selectEl, values) {
  if (!selectEl) return;
  // conserve l’option "Tous" déjà présente
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
  const dietVal = filterDiet ? filterDiet.value : "";

  const minPersonsVal = filterMinPersons && filterMinPersons.value !== ""
    ? Number(filterMinPersons.value)
    : null;

  const maxPriceVal = filterMaxPrice && filterMaxPrice.value !== ""
    ? Number(filterMaxPrice.value)
    : null;

  const filtered = menus.filter((m) => {
    if (themeVal && m.theme !== themeVal) return false;
    if (dietVal && m.diet !== dietVal) return false;
    if (minPersonsVal != null && m.minPersons < minPersonsVal) return false;
    if (maxPriceVal != null && m.priceMin > maxPriceVal) return false;
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

  if (resetFilters) {
    resetFilters.addEventListener("click", () => {
      if (filterTheme) filterTheme.value = "";
      if (filterDiet) filterDiet.value = "";
      if (filterMinPersons) filterMinPersons.value = "";
      if (filterMaxPrice) filterMaxPrice.value = "";
      renderMenus(menus);
      showList();
    });
  }
}


loadMenus();

let selectedMenuForOrder = null;

const orderForm = document.getElementById("orderForm");
const orderMsg = document.getElementById("orderMsg");

// Quand on clique sur "Commander"
if (orderBtn) {
  orderBtn.addEventListener("click", () => {
    selectedMenuForOrder = currentMenu; // menu affiché dans le détail
    orderForm.reset();
    orderMsg.classList.add("d-none");
    if (orderMsg) orderMsg.classList.add("d-none");
if (orderForm) orderForm.reset();
    orderModal.show();
  });
}

// Soumission de la commande (simulation)
const menuTitle = currentMenu ? currentMenu.title : "menu";

if (orderForm) {
  orderForm.addEventListener("submit", (e) => {
    e.preventDefault();


    const name = document.getElementById("orderName").value.trim();
    const email = document.getElementById("orderEmail").value.trim();
    const persons = Number(document.getElementById("orderPersons").value);

    if (!name || !email || !persons || persons < 1) {
      showOrderMsg("success", `Commande enregistrée (simulation) pour « ${menuTitle} ».`);

      return;
    }

    // Contrôle métier : minimum de personnes pour ce menu
    if (currentMenu && persons < currentMenu.minPersons) {
      showOrderMsg(
        "warning",
        `Minimum requis pour « ${currentMenu.title} » : ${currentMenu.minPersons} personnes.`
      );
      return; // ⛔ stop : on ne valide pas la commande
    }

    // success seulement si tout est ok 
    showOrderMsg(
      "success",
      `Commande enregistrée (simulation) pour le menu « ${selectedMenuForOrder.title} ».`
    );

    setTimeout(() => {
      orderModal.hide();
    }, 2000);
  });
}

function showOrderMsg(type, text) {
  orderMsg.className = `alert alert-${type}`;
  orderMsg.textContent = text;
  orderMsg.classList.remove("d-none");
}


