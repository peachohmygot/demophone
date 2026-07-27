// =====================================================================
//  CONFIGURATION  —  edit the three values below, then deploy.
// =====================================================================
//  Where to find them:
//    Supabase Dashboard → Project Settings → API
//      • Project URL      → SUPABASE_URL
//      • anon public key  → SUPABASE_ANON_KEY   (safe to expose; RLS protects data)
//
//  FACEBOOK_PAGE:
//    Your Messenger short name, i.e. the part after m.me/ in
//    m.me/YourPageName  →  put just "YourPageName" below.
// =====================================================================

export const SUPABASE_URL = "https://YOUR-PROJECT-ref.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

// Messenger username used by the "Chat on Facebook to Buy" button.
export const FACEBOOK_PAGE = "YourPageName";

// Storage bucket created by sql/schema.sql — usually no need to change.
export const BUCKET = "product-images";

// Currency label shown next to prices.
export const CURRENCY = "THB";
