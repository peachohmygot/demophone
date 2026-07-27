// Supabase client + shared helpers used across every page.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET, CURRENCY, FACEBOOK_PAGE } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { BUCKET, CURRENCY, FACEBOOK_PAGE };

// Turn a stored storage-path into a public image URL.
export function imageUrl(path) {
  if (!path) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// First image of a product (or a light-grey placeholder).
export function firstImage(product) {
  const p = product?.image_paths?.[0];
  return p ? imageUrl(p) : PLACEHOLDER;
}

export const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>
       <rect width='100%' height='100%' fill='#f2f2f2'/>
       <text x='50%' y='50%' font-size='20' fill='#bbb'
             text-anchor='middle' dominant-baseline='middle'
             font-family='sans-serif'>No image</text>
     </svg>`
  );

// Thousands separator, no decimals for whole numbers.
export function money(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// Discount percent from original → sale price.
export function discountPercent(product) {
  const o = Number(product.original_price) || 0;
  const s = Number(product.sale_price) || 0;
  if (o <= 0 || s <= 0 || s >= o) return 0;
  return Math.round(((o - s) / o) * 100);
}

// Savings amount in currency.
export function savings(product) {
  const o = Number(product.original_price) || 0;
  const s = Number(product.sale_price) || 0;
  return o > s ? o - s : 0;
}
