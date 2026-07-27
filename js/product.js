// Product detail: image slider with fullscreen zoom, savings, specs,
// Facebook CTA, related products, TH/EN toggle.
import {
  supabase, imageUrl, firstImage, PLACEHOLDER, money,
  discountPercent, savings, FACEBOOK_PAGE, CURRENCY,
} from "./supabase.js";
import { t, toggleLang, onLangChange, otherLangLabel } from "./i18n.js";
import { openLightbox } from "./lightbox.js";

const $ = (id) => document.getElementById(id);
const detailEl = $("detail"), statusEl = $("status"), toastEl = $("toast");

const id = new URLSearchParams(location.search).get("id");
let BRANDS = [], MODELS = [], PRODUCT = null;

init();

async function init() {
  $("backLink").textContent = t("back");
  $("langToggle").textContent = otherLangLabel();
  $("langToggle").onclick = toggleLang;
  statusEl.textContent = t("loading");

  $("toTop").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  window.addEventListener("scroll", () => {
    $("toTop").classList.toggle("show", window.scrollY > 500);
  }, { passive: true });

  if (!id) { statusEl.textContent = t("not_found"); return; }

  try {
    const [{ data: product, error }, { data: brands }, { data: models }] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).single(),
      supabase.from("brands").select("*"),
      supabase.from("models").select("*"),
    ]);
    if (error || !product) throw error || new Error("not found");
    BRANDS = brands || []; MODELS = models || []; PRODUCT = product;
    statusEl.className = "hidden";
    renderDetail(product);
    loadRelated(product);
  } catch (e) {
    console.error(e);
    statusEl.className = "empty";
    statusEl.textContent = t("not_found");
  }
}

onLangChange(() => {
  $("backLink").textContent = t("back");
  $("langToggle").textContent = otherLangLabel();
  if (PRODUCT) { detailEl.innerHTML = ""; renderDetail(PRODUCT); loadRelated(PRODUCT); }
});

const brandName = (i) => BRANDS.find((b) => b.id === i)?.name || "";
const modelName = (i) => MODELS.find((m) => m.id === i)?.name || "";

function renderDetail(p) {
  document.title = `${p.title} · Phone Catalog`;
  const disc = discountPercent(p);
  const save = savings(p);
  const imgs = (p.image_paths?.length ? p.image_paths.map(imageUrl) : [PLACEHOLDER]).slice(0, 7);

  detailEl.innerHTML = `
    <div class="detail">
      <div>
        <div class="slider">
          <div class="slides" id="slides">
            ${imgs.map((u) => `<img src="${u}" alt="${escapeHtml(p.title)}" />`).join("")}
          </div>
          ${imgs.length > 1 ? `
            <button class="nav prev" id="prev">‹</button>
            <button class="nav next" id="next">›</button>` : ""}
          <span class="zoom-badge">⤢</span>
        </div>
        ${imgs.length > 1 ? `<div class="dots" id="dots">
          ${imgs.map((_, i) => `<span class="${i === 0 ? "on" : ""}"></span>`).join("")}
        </div>` : ""}
        <div class="zoom-hint">${t("zoom_hint")}</div>
      </div>

      <div class="info">
        <h1>${escapeHtml(p.title)}</h1>
        <div class="pricebox">
          <span class="sale">${money(p.sale_price)} <small>${CURRENCY}</small></span>
          ${p.original_price > p.sale_price ? `<span class="orig">${money(p.original_price)}</span>` : ""}
          ${disc > 0 ? `<span class="disc">-${disc}%</span>` : ""}
        </div>
        ${save > 0 ? `<div class="save">${t("save", { n: money(save), c: CURRENCY })}</div>` : ""}

        <div class="specs">
          <div class="row"><span class="k">${t("brand")}</span><span class="v">${escapeHtml(brandName(p.brand_id)) || "—"}</span></div>
          <div class="row"><span class="k">${t("model")}</span><span class="v">${escapeHtml(modelName(p.model_id)) || "—"}</span></div>
          <div class="row"><span class="k">${t("model_year")}</span><span class="v">${p.release_year || "—"}</span></div>
          <div class="row"><span class="k">${t("condition")}</span><span class="v cond">${p.condition_percent}%</span></div>
          <div class="row"><span class="k">${t("status")}</span><span class="v">${p.is_sold ? t("sold") : t("available")}</span></div>
        </div>

        ${p.description ? `<div class="desc">${escapeHtml(p.description)}</div>` : ""}

        ${p.is_sold
          ? `<div class="soldnote">${t("sold_note")}</div>`
          : `<button class="buy" id="buy">${t("chat_full")}</button>`}
      </div>
    </div>`;

  const slides = $("slides");
  // Tap any photo to open the fullscreen zoom viewer.
  [...slides.querySelectorAll("img")].forEach((im, i) => {
    im.addEventListener("click", () => openLightbox(imgs, i));
  });
  detailEl.querySelector(".zoom-badge").onclick = () => openLightbox(imgs, currentSlide());

  if (imgs.length > 1) setupSlider(imgs.length);
  if (!p.is_sold) $("buy").onclick = () => copyAndChat(p);
}

function currentSlide() {
  const s = $("slides");
  return s ? Math.round(s.scrollLeft / s.clientWidth) : 0;
}

function setupSlider(n) {
  const slides = $("slides"), dots = $("dots");
  const go = (i) => slides.scrollTo({ left: slides.clientWidth * i, behavior: "smooth" });

  $("prev").onclick = () => go(Math.max(0, currentSlide() - 1));
  $("next").onclick = () => go(Math.min(n - 1, currentSlide() + 1));
  slides.addEventListener("scroll", () => {
    const i = currentSlide();
    [...dots.children].forEach((d, k) => d.classList.toggle("on", k === i));
  }, { passive: true });
}

async function copyAndChat(p) {
  const btn = $("buy");
  try {
    await navigator.clipboard.writeText(productText(p));
    btn.classList.add("copied");
    btn.textContent = t("copied_btn");
    toast(t("copied"));
  } catch { /* clipboard blocked — still open Messenger */ }
  window.open(`https://m.me/${FACEBOOK_PAGE}`, "_blank");
  setTimeout(() => { btn.classList.remove("copied"); btn.textContent = t("chat_full"); }, 2500);
}

function productText(p) {
  const lines = [
    p.title,
    `${brandName(p.brand_id)} ${modelName(p.model_id)}`.trim(),
    p.release_year ? `${t("msg_year")}: ${p.release_year}` : "",
    `${t("msg_cond")}: ${p.condition_percent}%`,
    p.original_price > p.sale_price ? `${t("msg_orig")}: ${money(p.original_price)} ${CURRENCY}` : "",
    `${t("msg_price")}: ${money(p.sale_price)} ${CURRENCY}`,
    savings(p) > 0 ? `${t("msg_save")}: ${money(savings(p))} ${CURRENCY}` : "",
    location.href,
  ].filter(Boolean);
  return t("msg_intro") + "\n\n" + lines.join("\n");
}

async function loadRelated(p) {
  if (!p.brand_id) return;
  const { data } = await supabase
    .from("products").select("*")
    .eq("brand_id", p.brand_id).neq("id", p.id).limit(8);
  const rel = (data || []).sort((a, b) => (a.is_sold === b.is_sold ? 0 : a.is_sold ? 1 : -1));
  if (!rel.length) return;

  const sec = document.createElement("div");
  sec.className = "related";
  sec.innerHTML = `<h2>${t("related")}</h2><div class="grid" id="relgrid"></div>`;
  detailEl.appendChild(sec);
  const grid = sec.querySelector("#relgrid");

  rel.forEach((r) => {
    const disc = discountPercent(r);
    const a = document.createElement("a");
    a.className = "card" + (r.is_sold ? " sold" : "");
    a.href = `./product.html?id=${r.id}`;
    a.innerHTML = `
      <div class="thumb">
        <img loading="lazy" src="${firstImage(r)}" alt="${escapeHtml(r.title)}" />
        ${r.is_sold ? `<span class="badge sold">${t("sold")}</span>` : ""}
        ${disc > 0 && !r.is_sold ? `<span class="badge disc">-${disc}%</span>` : ""}
      </div>
      <div class="body">
        <div class="title">${escapeHtml(r.title)}</div>
        <div class="price-row"><span class="sale">${money(r.sale_price)}</span></div>
        <div class="meta"><span class="cond">${r.condition_percent}%</span></div>
      </div>`;
    grid.appendChild(a);
  });
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
