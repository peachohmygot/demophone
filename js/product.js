// Product detail: image slider, savings, specs, FB CTA, related products.
import {
  supabase, imageUrl, firstImage, PLACEHOLDER, money,
  discountPercent, savings, FACEBOOK_PAGE, CURRENCY,
} from "./supabase.js";

const detailEl = document.getElementById("detail");
const statusEl = document.getElementById("status");
const toastEl = document.getElementById("toast");

const id = new URLSearchParams(location.search).get("id");
let BRANDS = [], MODELS = [];

init();

async function init() {
  if (!id) { statusEl.textContent = "No product specified."; return; }
  try {
    const [{ data: product, error }, { data: brands }, { data: models }] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).single(),
      supabase.from("brands").select("*"),
      supabase.from("models").select("*"),
    ]);
    if (error || !product) throw error || new Error("not found");
    BRANDS = brands || []; MODELS = models || [];
    statusEl.className = "hidden";
    renderDetail(product);
    loadRelated(product);
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Product not found.";
  }
}

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
        </div>
        ${imgs.length > 1 ? `<div class="dots" id="dots">
          ${imgs.map((_, i) => `<span class="${i === 0 ? "on" : ""}"></span>`).join("")}
        </div>` : ""}
      </div>

      <div class="info">
        <h1>${escapeHtml(p.title)}</h1>
        <div class="pricebox">
          <span class="sale">${money(p.sale_price)} <small>${CURRENCY}</small></span>
          ${p.original_price > p.sale_price ? `<span class="orig">${money(p.original_price)}</span>` : ""}
          ${disc > 0 ? `<span class="disc">-${disc}%</span>` : ""}
        </div>
        ${save > 0 ? `<div class="save">Save ${money(save)} ${CURRENCY}</div>` : ""}

        <div class="specs">
          <div class="row"><span class="k">Brand</span><span class="v">${escapeHtml(brandName(p.brand_id)) || "—"}</span></div>
          <div class="row"><span class="k">Model</span><span class="v">${escapeHtml(modelName(p.model_id)) || "—"}</span></div>
          <div class="row"><span class="k">Model Year</span><span class="v">${p.release_year || "—"}</span></div>
          <div class="row"><span class="k">Condition</span><span class="v cond">${p.condition_percent}%</span></div>
          <div class="row"><span class="k">Status</span><span class="v">${p.is_sold ? "Sold Out" : "Available"}</span></div>
        </div>

        ${p.description ? `<div class="desc">${escapeHtml(p.description)}</div>` : ""}

        ${p.is_sold
          ? `<div class="soldnote">❌ This item is sold out.</div>`
          : `<button class="buy" id="buy">💬 Chat on Facebook to Buy</button>`}
      </div>
    </div>`;

  if (imgs.length > 1) setupSlider(imgs.length);
  if (!p.is_sold) document.getElementById("buy").onclick = () => copyAndChat(p);
}

function setupSlider(n) {
  const slides = document.getElementById("slides");
  const dots = document.getElementById("dots");
  const go = (i) => slides.scrollTo({ left: slides.clientWidth * i, behavior: "smooth" });
  const current = () => Math.round(slides.scrollLeft / slides.clientWidth);

  document.getElementById("prev").onclick = () => go(Math.max(0, current() - 1));
  document.getElementById("next").onclick = () => go(Math.min(n - 1, current() + 1));
  slides.addEventListener("scroll", () => {
    const i = current();
    [...dots.children].forEach((d, k) => d.classList.toggle("on", k === i));
  });
}

async function copyAndChat(p) {
  const text = productText(p);
  const btn = document.getElementById("buy");
  try {
    await navigator.clipboard.writeText(text);
    btn.classList.add("copied");
    btn.textContent = "✔ Details copied — opening Messenger…";
    toast("Product details copied ✔");
  } catch { /* clipboard blocked — still open messenger */ }
  window.open(`https://m.me/${FACEBOOK_PAGE}`, "_blank");
  setTimeout(() => {
    btn.classList.remove("copied");
    btn.textContent = "💬 Chat on Facebook to Buy";
  }, 2500);
}

function productText(p) {
  const lines = [
    p.title,
    `${brandName(p.brand_id)} ${modelName(p.model_id)}`.trim(),
    p.release_year ? `Model Year: ${p.release_year}` : "",
    `Condition: ${p.condition_percent}%`,
    p.original_price > p.sale_price ? `Original: ${money(p.original_price)} ${CURRENCY}` : "",
    `Price: ${money(p.sale_price)} ${CURRENCY}`,
    savings(p) > 0 ? `You save: ${money(savings(p))} ${CURRENCY}` : "",
    location.href,
  ].filter(Boolean);
  return "I'm interested in this item:\n\n" + lines.join("\n");
}

async function loadRelated(p) {
  if (!p.brand_id) return;
  const { data } = await supabase
    .from("products").select("*")
    .eq("brand_id", p.brand_id)
    .neq("id", p.id)
    .limit(8);
  const rel = (data || []).sort((a, b) => (a.is_sold === b.is_sold ? 0 : a.is_sold ? 1 : -1));
  if (!rel.length) return;

  const sec = document.createElement("div");
  sec.className = "related";
  sec.innerHTML = `<h2>🔄 Similar models you may be interested in</h2>
    <div class="grid" id="relgrid"></div>`;
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
        ${r.is_sold ? '<span class="badge sold">SOLD</span>' : ""}
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
