// Bilingual Thai / English text for the buyer-facing pages.
// Language is remembered in localStorage; first-time visitors get Thai unless
// their browser is clearly set to English.

const STRINGS = {
  th: {
    search_ph: "ค้นหามือถือ…",
    tab_hot: "🔥 มาแรง",
    tab_all: "📱 สินค้าทั้งหมด",
    brand: "ยี่ห้อ",
    model: "รุ่น",
    price_min: "ราคาต่ำสุด",
    price_max: "ราคาสูงสุด",
    sort: "↕ เรียงลำดับ",
    sort_newest: "ค่าเริ่มต้น (ใหม่ล่าสุด)",
    sort_price_asc: "ราคา: ถูก → แพง",
    sort_price_desc: "ราคา: แพง → ถูก",
    sort_disc_desc: "ส่วนลด: มากที่สุด",
    sort_disc_asc: "ส่วนลด: น้อยที่สุด",
    sort_year_desc: "ปีรุ่น: ใหม่สุด",
    sort_year_asc: "ปีรุ่น: เก่าสุด",
    sort_cond_desc: "สภาพ: ดีที่สุด",
    sort_cond_asc: "สภาพ: น้อยที่สุด",
    loading: "กำลังโหลด…",
    empty: "ไม่พบสินค้า",
    count: "แสดง {n} รายการ",
    sold: "ขายแล้ว",
    hot: "🔥 มาแรง",
    chat_short: "💬 แชทสั่งซื้อ",
    chat_full: "💬 แชท Facebook เพื่อสั่งซื้อ",
    back: "← กลับ",
    model_year: "ปีรุ่น",
    condition: "สภาพ",
    status: "สถานะ",
    available: "พร้อมขาย",
    save: "ประหยัด {n} {c}",
    sold_note: "❌ สินค้าชิ้นนี้ขายแล้ว",
    related: "🔄 รุ่นใกล้เคียงที่คุณอาจสนใจ",
    copied: "คัดลอกรายละเอียดแล้ว ✔",
    copied_btn: "✔ คัดลอกแล้ว — กำลังเปิด Messenger…",
    not_found: "ไม่พบสินค้า",
    load_error: "โหลดสินค้าไม่สำเร็จ ตรวจสอบ js/config.js",
    top: "ขึ้นบนสุด",
    zoom_hint: "แตะรูปเพื่อดูเต็มจอ",
    msg_intro: "สนใจสินค้าชิ้นนี้ครับ/ค่ะ:",
    msg_year: "ปีรุ่น",
    msg_cond: "สภาพ",
    msg_orig: "ราคาเต็ม",
    msg_price: "ราคาขาย",
    msg_save: "ประหยัด",
  },
  en: {
    search_ph: "Search phones…",
    tab_hot: "🔥 Hot Hit",
    tab_all: "📱 All Products",
    brand: "Brand",
    model: "Model",
    price_min: "Min price",
    price_max: "Max price",
    sort: "↕ Sort",
    sort_newest: "Default (Newest)",
    sort_price_asc: "Price: Low → High",
    sort_price_desc: "Price: High → Low",
    sort_disc_desc: "Discount: Highest",
    sort_disc_asc: "Discount: Lowest",
    sort_year_desc: "Model Year: Newest",
    sort_year_asc: "Model Year: Oldest",
    sort_cond_desc: "Condition: Best",
    sort_cond_asc: "Condition: Lowest",
    loading: "Loading…",
    empty: "No products found",
    count: "Showing {n} items",
    sold: "SOLD OUT",
    hot: "🔥 HOT",
    chat_short: "💬 Chat to Buy",
    chat_full: "💬 Chat on Facebook to Buy",
    back: "← Back",
    model_year: "Model Year",
    condition: "Condition",
    status: "Status",
    available: "Available",
    save: "Save {n} {c}",
    sold_note: "❌ This item is sold out.",
    related: "🔄 Similar models you may be interested in",
    copied: "Product details copied ✔",
    copied_btn: "✔ Details copied — opening Messenger…",
    not_found: "Product not found.",
    load_error: "Could not load products. Check js/config.js.",
    top: "Back to top",
    zoom_hint: "Tap photo to view fullscreen",
    msg_intro: "I'm interested in this item:",
    msg_year: "Model Year",
    msg_cond: "Condition",
    msg_orig: "Original",
    msg_price: "Price",
    msg_save: "You save",
  },
};

const KEY = "catalog_lang";

function detect() {
  const saved = localStorage.getItem(KEY);
  if (saved === "th" || saved === "en") return saved;
  // Default to Thai unless the browser is explicitly English.
  return (navigator.language || "").toLowerCase().startsWith("en") ? "en" : "th";
}

let lang = detect();

export function getLang() { return lang; }

export function setLang(next) {
  if (next !== "th" && next !== "en") return;
  lang = next;
  localStorage.setItem(KEY, next);
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn(next));
}

export function toggleLang() { setLang(lang === "th" ? "en" : "th"); }

// t("save", { n: "1,000", c: "THB" })
export function t(key, vars) {
  let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

const listeners = [];
export function onLangChange(fn) { listeners.push(fn); }

// Label shown on the toggle button: shows the language you'd switch TO.
export function otherLangLabel() { return lang === "th" ? "EN" : "ไทย"; }

document.documentElement.lang = lang;
