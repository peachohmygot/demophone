// Admin panel: auth, product CRUD with dependent dropdowns + image compression,
// and brand/model management.
import { supabase, imageUrl, BUCKET, money } from "./supabase.js";
import { compressImage, humanSize } from "./compress.js";

/* ---------------- element refs ---------------- */
const $ = (id) => document.getElementById(id);
const loginView = $("loginView"), appView = $("appView");
const productsView = $("productsView"), categoriesView = $("categoriesView");
const toastEl = $("toast");

/* ---------------- state ---------------- */
let BRANDS = [], MODELS = [];
// Images staged in the form: { path?, url, size, file? }
//  - path+url only  → already uploaded (editing)
//  - file present   → new, needs upload on save
let stagedImages = [];
const MAX_IMAGES = 7;

/* ================= AUTH ================= */
supabase.auth.onAuthStateChange((_e, session) => {
  if (session) showApp(); else showLogin();
});
supabase.auth.getSession().then(({ data }) => data.session ? showApp() : showLogin());

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginError").textContent = "";
  const { error } = await supabase.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value,
  });
  if (error) $("loginError").textContent = error.message;
});

$("logoutBtn").addEventListener("click", () => supabase.auth.signOut());

function showLogin() { loginView.classList.remove("hidden"); appView.classList.add("hidden"); }
async function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  await loadCategories();
  await loadProducts();
  renderCategoryTables();
}

/* ---------------- view switching ---------------- */
document.querySelectorAll(".admin-nav button[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav button[data-view]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const v = btn.dataset.view;
    productsView.classList.toggle("hidden", v !== "products");
    categoriesView.classList.toggle("hidden", v !== "categories");
  });
});

/* ================= CATEGORIES ================= */
async function loadCategories() {
  const [{ data: b }, { data: m }] = await Promise.all([
    supabase.from("brands").select("*").order("name"),
    supabase.from("models").select("*").order("name"),
  ]);
  BRANDS = b || []; MODELS = m || [];
  fillBrandSelect($("brandSelect"));
  fillBrandSelect($("modelBrandSelect"));
  refreshModelSelect();
}

function fillBrandSelect(sel, keep) {
  const cur = keep ?? sel.value;
  sel.innerHTML = '<option value="">Select brand…</option>';
  BRANDS.forEach((br) => {
    const o = document.createElement("option");
    o.value = br.id; o.textContent = br.name;
    sel.appendChild(o);
  });
  if (cur) sel.value = cur;
}

// Dependent dropdown: models filtered by the chosen brand.
function refreshModelSelect(keep) {
  const sel = $("modelSelect");
  const brandId = $("brandSelect").value;
  const cur = keep ?? "";
  sel.innerHTML = '<option value="">Select model…</option>';
  MODELS.filter((m) => m.brand_id === brandId).forEach((m) => {
    const o = document.createElement("option");
    o.value = m.id; o.textContent = m.name;
    sel.appendChild(o);
  });
  if (cur) sel.value = cur;
}
$("brandSelect").addEventListener("change", () => refreshModelSelect());

// --- add / delete / edit brands ---
$("brandForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("brandName").value.trim();
  if (!name) return;
  const { error } = await supabase.from("brands").insert({ name });
  if (error) return toast(error.message);
  $("brandName").value = "";
  await loadCategories(); renderCategoryTables();
  toast("Brand added");
});

$("modelForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const brand_id = $("modelBrandSelect").value;
  const name = $("modelName").value.trim();
  if (!brand_id || !name) return toast("Pick a brand and enter a model name");
  const { error } = await supabase.from("models").insert({ brand_id, name });
  if (error) return toast(error.message);
  $("modelName").value = "";
  await loadCategories(); renderCategoryTables();
  toast("Model added");
});

function renderCategoryTables() {
  // brands
  const bt = $("brandsTable").querySelector("tbody");
  bt.innerHTML = "";
  BRANDS.forEach((br) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(br.name)}</td>
      <td class="actions">
        <button class="btn light small" data-edit="${br.id}">Edit</button>
        <button class="btn danger small" data-del="${br.id}">Delete</button>
      </td>`;
    tr.querySelector("[data-edit]").onclick = () => editBrand(br);
    tr.querySelector("[data-del]").onclick = () => delBrand(br);
    bt.appendChild(tr);
  });

  // models
  const mt = $("modelsTable").querySelector("tbody");
  mt.innerHTML = "";
  MODELS.forEach((m) => {
    const brand = BRANDS.find((b) => b.id === m.brand_id);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(m.name)}<div class="muted">${escapeHtml(brand?.name || "—")}</div></td>
      <td class="actions">
        <button class="btn light small" data-edit>Edit</button>
        <button class="btn danger small" data-del>Delete</button>
      </td>`;
    tr.querySelector("[data-edit]").onclick = () => editModel(m);
    tr.querySelector("[data-del]").onclick = () => delModel(m);
    mt.appendChild(tr);
  });
}

async function editBrand(br) {
  const name = prompt("Rename brand:", br.name);
  if (!name || name.trim() === br.name) return;
  const { error } = await supabase.from("brands").update({ name: name.trim() }).eq("id", br.id);
  if (error) return toast(error.message);
  await loadCategories(); renderCategoryTables(); toast("Brand updated");
}
async function delBrand(br) {
  if (!confirm(`Delete brand "${br.name}"? Its models will also be removed.`)) return;
  const { error } = await supabase.from("brands").delete().eq("id", br.id);
  if (error) return toast(error.message);
  await loadCategories(); renderCategoryTables(); toast("Brand deleted");
}
async function editModel(m) {
  const name = prompt("Rename model:", m.name);
  if (!name || name.trim() === m.name) return;
  const { error } = await supabase.from("models").update({ name: name.trim() }).eq("id", m.id);
  if (error) return toast(error.message);
  await loadCategories(); renderCategoryTables(); toast("Model updated");
}
async function delModel(m) {
  if (!confirm(`Delete model "${m.name}"?`)) return;
  const { error } = await supabase.from("models").delete().eq("id", m.id);
  if (error) return toast(error.message);
  await loadCategories(); renderCategoryTables(); toast("Model deleted");
}

/* ================= PRODUCTS ================= */
async function loadProducts() {
  const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  renderProductsTable(data || []);
}

function renderProductsTable(products) {
  const tb = $("productsTable").querySelector("tbody");
  tb.innerHTML = "";
  if (!products.length) {
    tb.innerHTML = `<tr><td colspan="6" class="muted" style="padding:20px">No products yet.</td></tr>`;
    return;
  }
  products.forEach((p) => {
    const thumb = p.image_paths?.[0] ? imageUrl(p.image_paths[0]) : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${thumb ? `<img class="mini-thumb" src="${thumb}" />` : ""}</td>
      <td>${escapeHtml(p.title)}
        ${p.is_hot_hit ? '<span class="pill hot">HOT</span>' : ""}</td>
      <td>${money(p.sale_price)}</td>
      <td>${p.condition_percent}%</td>
      <td><span class="pill ${p.is_sold ? "sold" : "live"}">${p.is_sold ? "Sold" : "Live"}</span></td>
      <td class="actions">
        <button class="btn light small" data-edit>Edit</button>
        <button class="btn danger small" data-del>Del</button>
      </td>`;
    tr.querySelector("[data-edit]").onclick = () => startEdit(p);
    tr.querySelector("[data-del]").onclick = () => deleteProduct(p);
    tb.appendChild(tr);
  });
}

/* ---- image picking + compression ---- */
$("imageInput").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  for (const file of files) {
    if (stagedImages.length >= MAX_IMAGES) { toast(`Max ${MAX_IMAGES} images`); break; }
    const placeholder = { url: "", size: 0, compressing: true };
    stagedImages.push(placeholder);
    renderThumbs();
    try {
      const compressed = await compressImage(file);
      Object.assign(placeholder, {
        file: compressed,
        url: URL.createObjectURL(compressed),
        size: compressed.size,
        compressing: false,
      });
    } catch (err) {
      console.error(err);
      stagedImages = stagedImages.filter((s) => s !== placeholder);
      toast("Could not process an image");
    }
    renderThumbs();
  }
});

function renderThumbs() {
  const box = $("thumbs");
  box.innerHTML = "";
  stagedImages.forEach((img, i) => {
    const d = document.createElement("div");
    d.className = "t" + (i === 0 ? " cover" : "");

    if (img.compressing) {
      d.innerHTML = `<div class="muted" style="display:flex;align-items:center;justify-content:center;height:100%;font-size:11px">…</div>`;
      box.appendChild(d);
      return;
    }

    d.draggable = true;
    d.dataset.index = i;
    d.innerHTML = `<img src="${img.url}" />
      <button type="button" class="rm" title="remove">×</button>
      ${i === 0 ? '<span class="cover-tag">COVER</span>' : ""}
      <span class="sz">${img.size ? humanSize(img.size) : "saved"}</span>
      <div class="move">
        <button type="button" class="mv" data-dir="-1" ${i === 0 ? "disabled" : ""}>◀</button>
        <button type="button" class="mv" data-dir="1" ${i === stagedImages.length - 1 ? "disabled" : ""}>▶</button>
      </div>`;

    d.querySelector(".rm").onclick = () => { stagedImages.splice(i, 1); renderThumbs(); };
    d.querySelectorAll(".mv").forEach((b) => {
      b.onclick = () => move(i, i + Number(b.dataset.dir));
    });

    // Desktop drag-and-drop reordering.
    d.addEventListener("dragstart", (e) => {
      dragFrom = i;
      d.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    d.addEventListener("dragend", () => d.classList.remove("dragging"));
    d.addEventListener("dragover", (e) => { e.preventDefault(); d.classList.add("over"); });
    d.addEventListener("dragleave", () => d.classList.remove("over"));
    d.addEventListener("drop", (e) => {
      e.preventDefault();
      d.classList.remove("over");
      if (dragFrom !== null && dragFrom !== i) move(dragFrom, i);
      dragFrom = null;
    });

    box.appendChild(d);
  });
}

let dragFrom = null;

// Move a staged image to a new position; index 0 is the cover photo.
function move(from, to) {
  if (to < 0 || to >= stagedImages.length) return;
  const [item] = stagedImages.splice(from, 1);
  stagedImages.splice(to, 0, item);
  renderThumbs();
}

/* ---- submit (create or update) ---- */
$("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (stagedImages.some((s) => s.compressing)) return toast("Please wait — images still compressing");

  const saveBtn = $("saveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    // Upload any new images, keep already-uploaded paths in order.
    const paths = [];
    for (const img of stagedImages) {
      if (img.path) { paths.push(img.path); continue; }
      const path = `products/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET)
        .upload(path, img.file, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      paths.push(path);
    }

    const payload = {
      title: $("title").value.trim(),
      brand_id: $("brandSelect").value || null,
      model_id: $("modelSelect").value || null,
      description: $("description").value.trim(),
      original_price: num($("originalPrice").value),
      sale_price: num($("salePrice").value),
      release_year: $("releaseYear").value ? parseInt($("releaseYear").value, 10) : null,
      condition_percent: parseInt($("conditionPercent").value, 10) || 0,
      image_paths: paths,
      is_hot_hit: $("isHotHit").checked,
      is_sold: $("isSold").checked,
    };

    const id = $("productId").value;
    let error;
    if (id) {
      // Remove storage objects the admin dropped during this edit.
      await cleanupRemovedImages(id, paths);
      ({ error } = await supabase.from("products").update(payload).eq("id", id));
    } else {
      ({ error } = await supabase.from("products").insert(payload));
    }
    if (error) throw error;

    toast(id ? "Product updated" : "Product added");
    resetForm();
    await loadProducts();
  } catch (err) {
    console.error(err);
    toast(err.message || "Save failed");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save product";
  }
});

// Delete storage files that were on the product before but aren't in the new set.
async function cleanupRemovedImages(id, keptPaths) {
  const { data } = await supabase.from("products").select("image_paths").eq("id", id).single();
  const old = data?.image_paths || [];
  const gone = old.filter((p) => !keptPaths.includes(p));
  if (gone.length) await supabase.storage.from(BUCKET).remove(gone);
}

function startEdit(p) {
  $("formTitle").textContent = "✏️ Edit Product";
  $("productId").value = p.id;
  $("title").value = p.title;
  fillBrandSelect($("brandSelect"), p.brand_id || "");
  refreshModelSelect(p.model_id || "");
  $("originalPrice").value = p.original_price || "";
  $("salePrice").value = p.sale_price || "";
  $("releaseYear").value = p.release_year || "";
  $("conditionPercent").value = p.condition_percent ?? 100;
  $("description").value = p.description || "";
  $("isHotHit").checked = !!p.is_hot_hit;
  $("isSold").checked = !!p.is_sold;

  stagedImages = (p.image_paths || []).map((path) => ({
    path, url: imageUrl(path), size: 0,
  }));
  renderThumbs();
  $("cancelEdit").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("cancelEdit").addEventListener("click", resetForm);

function resetForm() {
  $("productForm").reset();
  $("productId").value = "";
  $("formTitle").textContent = "➕ New Product";
  $("conditionPercent").value = 100;
  stagedImages = [];
  renderThumbs();
  refreshModelSelect();
  $("cancelEdit").classList.add("hidden");
}

async function deleteProduct(p) {
  if (!confirm(`Delete "${p.title}"? This also removes its images.`)) return;
  // Delete DB row first; the DB trigger clears storage rows too, but we also
  // remove the files directly to be safe.
  if (p.image_paths?.length) await supabase.storage.from(BUCKET).remove(p.image_paths);
  const { error } = await supabase.from("products").delete().eq("id", p.id);
  if (error) return toast(error.message);
  toast("Product deleted");
  await loadProducts();
}

/* ---------------- helpers ---------------- */
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
