// Customer catalog: tabs, search, brand/model filters, sorting, sold-out to bottom.
import {
  supabase, firstImage, money, discountPercent, FACEBOOK_PAGE, CURRENCY,
} from "./supabase.js";

const els = {
  tabs: document.getElementById("tabs"),
  search: document.getElementById("search"),
  filterBrand: document.getElementById("filterBrand"),
  filterModel: document.getElementById("filterModel"),
  sortBtn: document.getElementById("sortBtn"),
  sortMenu: document.getElementById("sortMenu"),
  grid: document.getElementById("grid"),
  status: document.getElementById("status"),
  toast: document.getElementById("toast"),
};

let PRODUCTS = [];
let BRANDS = [];
let MODELS = [];

const state = {
  tab: "all",          // "all" | "hot" | brandId
  brand: "",
  model: "",
  q: "",
  sort: "newest",
};

init();

async function init() {
  try {
    const [{ data: brands }, { data: models }, { data: products }] = await Promise.all([
      supabase.from("brands").select("*").order("name"),
      supabase.from("models").select("*").order("name"),
      supabase.from("products").select("*"),
    ]);
    BRANDS = brands || [];
    MODELS = models || [];
    PRODUCTS = products || [];

    buildTabs();
    buildBrandFilter();
    wireControls();
    render();
  } catch (e) {
    console.error(e);
    els.status.textContent = "Could not load products. Check js/config.js.";
  }
}

function buildTabs() {
  const tabs = [
    { id: "hot", label: "🔥 Hot Hit" },
    { id: "all", label: "📱 All Products" },
    ...BRANDS.map((b) => ({ id: b.id, label: b.name })),
  ];
  els.tabs.innerHTML = "";
  tabs.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (t.id === state.tab ? " active" : "");
    btn.textContent = t.label;
    btn.onclick = () => {
      state.tab = t.id;
      // Selecting a brand tab also drives the brand filter for clarity.
      if (t.id !== "hot" && t.id !== "all") {
        state.brand = t.id;
        els.filterBrand.value = t.id;
        refreshModelFilter();
      }
      [...els.tabs.children].forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      render();
    };
    els.tabs.appendChild(btn);
  });
}

function buildBrandFilter() {
  els.filterBrand.innerHTML = '<option value="">Brand</option>';
  BRANDS.forEach((b) => {
    const o = document.createElement("option");
    o.value = b.id;
    o.textContent = b.name;
    els.filterBrand.appendChild(o);
  });
  refreshModelFilter();
}

function refreshModelFilter() {
  els.filterModel.innerHTML = '<option value="">Model</option>';
  const list = state.brand ? MODELS.filter((m) => m.brand_id === state.brand) : MODELS;
  list.forEach((m) => {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.name;
    els.filterModel.appendChild(o);
  });
  els.filterModel.value = "";
  state.model = "";
}

function wireControls() {
  els.search.addEventListener("input", (e) => {
    state.q = e.target.value.trim().toLowerCase();
    render();
  });

  els.filterBrand.addEventListener("change", (e) => {
    state.brand = e.target.value;
    refreshModelFilter();
    render();
  });

  els.filterModel.addEventListener("change", (e) => {
    state.model = e.target.value;
    render();
  });

  els.sortBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    els.sortMenu.classList.toggle("open");
  });
  document.addEventListener("click", () => els.sortMenu.classList.remove("open"));
  els.sortMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-sort]");
    if (!btn) return;
    state.sort = btn.dataset.sort;
    [...els.sortMenu.children].forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    els.sortMenu.classList.remove("open");
    render();
  });
}

function brandName(id) { return BRANDS.find((b) => b.id === id)?.name || ""; }
function modelName(id) { return MODELS.find((m) => m.id === id)?.name || ""; }

function filtered() {
  let list = PRODUCTS.slice();

  if (state.tab === "hot") list = list.filter((p) => p.is_hot_hit);
  else if (state.tab !== "all") list = list.filter((p) => p.brand_id === state.tab);

  if (state.brand) list = list.filter((p) => p.brand_id === state.brand);
  if (state.model) list = list.filter((p) => p.model_id === state.model);

  if (state.q) {
    list = list.filter((p) => {
      const hay = [p.title, brandName(p.brand_id), modelName(p.model_id), p.release_year]
        .join(" ").toLowerCase();
      return hay.includes(state.q);
    });
  }

  const cmp = {
    price_asc: (a, b) => a.sale_price - b.sale_price,
    price_desc: (a, b) => b.sale_price - a.sale_price,
    disc_desc: (a, b) => discountPercent(b) - discountPercent(a),
    disc_asc: (a, b) => discountPercent(a) - discountPercent(b),
    year_desc: (a, b) => (b.release_year || 0) - (a.release_year || 0),
    year_asc: (a, b) => (a.release_year || 0) - (b.release_year || 0),
    cond_desc: (a, b) => (b.condition_percent || 0) - (a.condition_percent || 0),
    cond_asc: (a, b) => (a.condition_percent || 0) - (b.condition_percent || 0),
    newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  }[state.sort];

  list.sort(cmp);
  // Sold-out items always sink to the bottom, preserving the chosen order within each group.
  list.sort((a, b) => (a.is_sold === b.is_sold ? 0 : a.is_sold ? 1 : -1));
  return list;
}

function render() {
  const list = filtered();
  els.grid.innerHTML = "";
  if (!list.length) {
    els.status.className = "empty";
    els.status.textContent = "No products found.";
    return;
  }
  els.status.className = "hidden";
  list.forEach((p) => els.grid.appendChild(card(p)));
}

function card(p) {
  const disc = discountPercent(p);
  const el = document.createElement("div");
  el.className = "card" + (p.is_sold ? " sold" : "");

  el.innerHTML = `
    <a class="thumb" href="./product.html?id=${p.id}">
      <img loading="lazy" src="${firstImage(p)}" alt="${escapeHtml(p.title)}" />
      ${p.is_hot_hit && !p.is_sold ? '<span class="badge hot">🔥 HOT</span>' : ""}
      ${p.is_sold ? '<span class="badge sold">SOLD OUT</span>' : ""}
      ${disc > 0 && !p.is_sold ? `<span class="badge disc">-${disc}%</span>` : ""}
    </a>
    <div class="body">
      <a class="title" href="./product.html?id=${p.id}">${escapeHtml(p.title)}</a>
      <div class="price-row">
        <span class="sale">${money(p.sale_price)}</span>
        ${p.original_price > p.sale_price ? `<span class="orig">${money(p.original_price)}</span>` : ""}
      </div>
      <div class="meta">
        <span class="cond">${p.condition_percent}%</span>
        <span class="year">${p.release_year ? "'" + String(p.release_year).slice(-2) : ""}</span>
      </div>
      <button class="chat" ${p.is_sold ? "disabled" : ""}>
        ${p.is_sold ? "Sold Out" : "💬 Chat to Buy"}
      </button>
    </div>`;

  const chat = el.querySelector(".chat");
  if (!p.is_sold) {
    chat.onclick = (e) => {
      e.preventDefault();
      copyAndChat(p);
    };
  }
  return el;
}

async function copyAndChat(p) {
  const text = productText(p);
  try { await navigator.clipboard.writeText(text); toast("Product details copied ✔"); }
  catch { /* clipboard may be blocked; continue to Messenger anyway */ }
  window.open(`https://m.me/${FACEBOOK_PAGE}`, "_blank");
}

function productText(p) {
  const lines = [
    p.title,
    `${brandName(p.brand_id)} ${modelName(p.model_id)}`.trim(),
    p.release_year ? `Model Year: ${p.release_year}` : "",
    `Condition: ${p.condition_percent}%`,
    `Price: ${money(p.sale_price)} ${CURRENCY}`,
    `${location.origin}${location.pathname.replace(/index\.html$/, "")}product.html?id=${p.id}`,
  ].filter(Boolean);
  return "I'm interested in this item:\n\n" + lines.join("\n");
}

let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
