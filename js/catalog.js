// Customer catalog: tabs, search, brand/model/price filters, sorting,
// sold-out to bottom, skeleton loading, back-to-top, TH/EN toggle.
import {
  supabase, firstImage, money, discountPercent, FACEBOOK_PAGE, CURRENCY,
} from "./supabase.js";
import { t, getLang, toggleLang, onLangChange, otherLangLabel } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const els = {
  tabs: $("tabs"), search: $("search"),
  filterBrand: $("filterBrand"), filterModel: $("filterModel"),
  priceMin: $("priceMin"), priceMax: $("priceMax"),
  sortBtn: $("sortBtn"), sortMenu: $("sortMenu"),
  grid: $("grid"), status: $("status"), count: $("count"),
  toast: $("toast"), toTop: $("toTop"), langToggle: $("langToggle"),
};

let PRODUCTS = [], BRANDS = [], MODELS = [];
let loaded = false;

const state = { tab: "all", brand: "", model: "", q: "", sort: "newest", min: null, max: null };

init();

async function init() {
  applyStaticText();
  wireControls();
  showSkeletons();

  try {
    const [{ data: brands }, { data: models }, { data: products }] = await Promise.all([
      supabase.from("brands").select("*").order("name"),
      supabase.from("models").select("*").order("name"),
      supabase.from("products").select("*"),
    ]);
    BRANDS = brands || []; MODELS = models || []; PRODUCTS = products || [];
    loaded = true;
    buildTabs();
    buildBrandFilter();
    render();
  } catch (e) {
    console.error(e);
    els.grid.innerHTML = "";
    els.status.className = "empty";
    els.status.textContent = t("load_error");
  }
}

/* ---------- language ---------- */
function applyStaticText() {
  els.search.placeholder = t("search_ph");
  els.priceMin.placeholder = t("price_min");
  els.priceMax.placeholder = t("price_max");
  els.sortBtn.textContent = t("sort");
  els.langToggle.textContent = otherLangLabel();

  const sortKeys = {
    newest: "sort_newest", price_asc: "sort_price_asc", price_desc: "sort_price_desc",
    disc_desc: "sort_disc_desc", disc_asc: "sort_disc_asc",
    year_desc: "sort_year_desc", year_asc: "sort_year_asc",
    cond_desc: "sort_cond_desc", cond_asc: "sort_cond_asc",
  };
  els.sortMenu.querySelectorAll("button[data-sort]").forEach((b) => {
    b.textContent = t(sortKeys[b.dataset.sort]);
  });
}

onLangChange(() => {
  applyStaticText();
  if (loaded) { buildTabs(); buildBrandFilter(true); render(); }
});

/* ---------- skeletons ---------- */
function showSkeletons() {
  els.grid.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const s = document.createElement("div");
    s.className = "card skel";
    s.innerHTML = `<div class="thumb sk"></div>
      <div class="body">
        <div class="sk line"></div><div class="sk line short"></div>
        <div class="sk line price"></div>
      </div>`;
    els.grid.appendChild(s);
  }
}

/* ---------- tabs & filters ---------- */
function buildTabs() {
  const tabs = [
    { id: "hot", label: t("tab_hot") },
    { id: "all", label: t("tab_all") },
    ...BRANDS.map((b) => ({ id: b.id, label: b.name })),
  ];
  els.tabs.innerHTML = "";
  tabs.forEach((tb) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (tb.id === state.tab ? " active" : "");
    btn.textContent = tb.label;
    btn.onclick = () => {
      state.tab = tb.id;
      if (tb.id !== "hot" && tb.id !== "all") {
        state.brand = tb.id;
        els.filterBrand.value = tb.id;
        refreshModelFilter();
      }
      [...els.tabs.children].forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      render();
    };
    els.tabs.appendChild(btn);
  });
}

function buildBrandFilter(keepSelection) {
  const cur = keepSelection ? state.brand : "";
  els.filterBrand.innerHTML = `<option value="">${t("brand")}</option>`;
  BRANDS.forEach((b) => {
    const o = document.createElement("option");
    o.value = b.id; o.textContent = b.name;
    els.filterBrand.appendChild(o);
  });
  els.filterBrand.value = cur;
  state.brand = cur;
  refreshModelFilter(keepSelection ? state.model : "");
}

function refreshModelFilter(keep = "") {
  els.filterModel.innerHTML = `<option value="">${t("model")}</option>`;
  const list = state.brand ? MODELS.filter((m) => m.brand_id === state.brand) : MODELS;
  list.forEach((m) => {
    const o = document.createElement("option");
    o.value = m.id; o.textContent = m.name;
    els.filterModel.appendChild(o);
  });
  els.filterModel.value = keep || "";
  state.model = els.filterModel.value;
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
  els.filterModel.addEventListener("change", (e) => { state.model = e.target.value; render(); });

  const priceChanged = () => {
    state.min = els.priceMin.value === "" ? null : Number(els.priceMin.value);
    state.max = els.priceMax.value === "" ? null : Number(els.priceMax.value);
    render();
  };
  els.priceMin.addEventListener("input", priceChanged);
  els.priceMax.addEventListener("input", priceChanged);

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

  els.langToggle.addEventListener("click", toggleLang);

  els.toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  window.addEventListener("scroll", () => {
    els.toTop.classList.toggle("show", window.scrollY > 500);
  }, { passive: true });
}

const brandName = (id) => BRANDS.find((b) => b.id === id)?.name || "";
const modelName = (id) => MODELS.find((m) => m.id === id)?.name || "";

function filtered() {
  let list = PRODUCTS.slice();

  if (state.tab === "hot") list = list.filter((p) => p.is_hot_hit);
  else if (state.tab !== "all") list = list.filter((p) => p.brand_id === state.tab);

  if (state.brand) list = list.filter((p) => p.brand_id === state.brand);
  if (state.model) list = list.filter((p) => p.model_id === state.model);
  if (state.min !== null) list = list.filter((p) => Number(p.sale_price) >= state.min);
  if (state.max !== null) list = list.filter((p) => Number(p.sale_price) <= state.max);

  if (state.q) {
    list = list.filter((p) =>
      [p.title, brandName(p.brand_id), modelName(p.model_id), p.release_year]
        .join(" ").toLowerCase().includes(state.q));
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
  // Sold-out items always sink to the bottom, keeping the chosen order within each group.
  list.sort((a, b) => (a.is_sold === b.is_sold ? 0 : a.is_sold ? 1 : -1));
  return list;
}

function render() {
  const list = filtered();
  els.grid.innerHTML = "";
  els.count.textContent = list.length ? t("count", { n: list.length }) : "";

  if (!list.length) {
    els.status.className = "empty";
    els.status.textContent = t("empty");
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
      ${p.is_hot_hit && !p.is_sold ? `<span class="badge hot">${t("hot")}</span>` : ""}
      ${p.is_sold ? `<span class="badge sold">${t("sold")}</span>` : ""}
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
        ${p.is_sold ? t("sold") : t("chat_short")}
      </button>
    </div>`;

  if (!p.is_sold) {
    el.querySelector(".chat").onclick = (e) => { e.preventDefault(); copyAndChat(p); };
  }
  return el;
}

async function copyAndChat(p) {
  try { await navigator.clipboard.writeText(productText(p)); toast(t("copied")); }
  catch { /* clipboard may be blocked; still open Messenger */ }
  window.open(`https://m.me/${FACEBOOK_PAGE}`, "_blank");
}

function productText(p) {
  const base = location.href.replace(/index\.html.*$/, "").replace(/\?.*$/, "");
  const lines = [
    p.title,
    `${brandName(p.brand_id)} ${modelName(p.model_id)}`.trim(),
    p.release_year ? `${t("msg_year")}: ${p.release_year}` : "",
    `${t("msg_cond")}: ${p.condition_percent}%`,
    `${t("msg_price")}: ${money(p.sale_price)} ${CURRENCY}`,
    `${base}product.html?id=${p.id}`,
  ].filter(Boolean);
  return t("msg_intro") + "\n\n" + lines.join("\n");
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
