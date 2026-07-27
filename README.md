# 📱 Phone Catalog

A minimalist, mobile-first second-hand phone catalog with a customer storefront
and a secure admin panel. **Static frontend** (plain HTML/CSS/JS, no build step)
+ **Supabase** (Postgres + Storage) backend, deployed on **Cloudflare Pages**.

---

## ✨ Features

**Customer storefront**
- Clean solid-white UI — no logo, no header, no clutter
- Sticky search box + horizontal category tabs (🔥 Hot Hit / 📱 All Products / per brand)
- Smart grid — **2 per row on mobile, 4 on desktop**
- Brand & Model filters + a **Sort** menu (price, discount, model year, condition)
- **Sold-out** cards get a badge, a disabled chat button, and sink to the bottom
- Product detail page: swipeable image slider (up to 7 photos), strikethrough
  original price, sale price, **“Save … THB”**, model year & condition %
- **“Chat on Facebook to Buy”** — copies the product details to the clipboard
  and opens Messenger (`m.me/YourPage`)
- **🔄 Similar models** section (same brand)

**Admin panel** (`/admin.html`)
- Secure email/password login (Supabase Auth)
- New/Edit product form with **dependent dropdowns** (brand → models)
- Model Year, Condition %, **Hot Hit** & **Sold Out** toggles
- **Automatic image compression** to ~300–500 KB in the browser before upload
- Brand & Model management (add / edit / delete)

**Backend**
- Full SQL schema with Row Level Security (public read, admin write)
- `sold_at` is stamped automatically when an item is marked Sold Out
- **Auto-delete**: a daily `pg_cron` job removes items sold for **60+ days**
  (and their images) to save storage

---

## 🗂️ Project structure

```
index.html          Customer catalog
product.html        Product detail page
admin.html          Admin panel (login + products + categories)
css/style.css       All styles
js/config.js        ← YOU EDIT THIS (Supabase keys + Facebook page)
js/supabase.js      Supabase client + shared helpers
js/catalog.js       Catalog logic
js/product.js       Detail-page logic
js/compress.js      Client-side image compression
js/admin.js         Admin logic
sql/schema.sql      ← RUN THIS in Supabase (tables, RLS, storage, auto-delete)
sql/seed.sql        Optional demo data
```

---

## 🚀 Setup — Step by step

### 1. Create a Supabase project
1. Go to <https://supabase.com> → **New project**. Pick a name, password, region.
2. Wait for it to finish provisioning.

### 2. Run the database schema
1. In the Supabase dashboard open **SQL Editor → New query**.
2. Open [`sql/schema.sql`](sql/schema.sql), copy the **entire** file, paste it in.
3. Click **Run**. This creates the tables, security policies, the
   `product-images` storage bucket, and the daily auto-delete job.
   - *(Optional)* repeat with [`sql/seed.sql`](sql/seed.sql) to load demo products.

> **`pg_cron` note:** the schema enables `pg_cron` for the daily auto-delete.
> If your project reports it isn’t available, enable it under
> **Database → Extensions → `pg_cron`**, then re-run `schema.sql`.

### 3. Create the admin user
1. **Authentication → Users → Add user** → enter an email + password.
   *(Tip: turn off “Auto-confirm” prompts by just adding the user directly,
   or confirm the email so it can sign in.)*
2. This is the account you’ll use to log in at `/admin.html`.

### 4. Configure the frontend
Open [`js/config.js`](js/config.js) and fill in:

```js
export const SUPABASE_URL      = "https://YOUR-PROJECT-ref.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
export const FACEBOOK_PAGE     = "YourPageName";   // the part after m.me/
```

Find the URL and **anon public** key under **Project Settings → API**.
The anon key is safe to expose publicly — Row Level Security protects your data.

### 5. Test locally (optional)
Because the code uses ES modules, open it through a tiny web server (not `file://`):

```bash
# any one of these from the project folder
python3 -m http.server 8080
# or:  npx serve .
```
Then visit <http://localhost:8080> and <http://localhost:8080/admin.html>.

---

## ☁️ Deploy to Cloudflare Pages (GitHub auto-deploy)

### Push to GitHub
```bash
git init                      # if not already a repo
git add .
git commit -m "Phone catalog"
git branch -M main
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

### Connect Cloudflare Pages
1. Go to the **Cloudflare dashboard → Workers & Pages → Create → Pages →
   Connect to Git**.
2. Pick your repository and branch (`main`).
3. Build settings — **this is a static site, so leave them empty**:
   - **Framework preset:** `None`
   - **Build command:** *(leave blank)*
   - **Build output directory:** `/`  (the repo root)
4. Click **Save and Deploy**.

That’s it. Every `git push` to `main` now auto-deploys. Your store is live at
`https://your-project.pages.dev` and the admin at `.../admin.html`.

> Add your Cloudflare domain to Supabase **Authentication → URL Configuration →
> Site URL / Redirect URLs** if you later enable email-based auth flows.
> (Password login used here works without it.)

---

## 🧹 Auto-delete details

- Marking a product **Sold Out** stamps `sold_at` (via a DB trigger).
- A `pg_cron` job (`delete_stale_sold_products`) runs **daily at 03:00 UTC** and
  deletes any product where `is_sold = true` and `sold_at` is older than
  **60 days**.
- Deleting a product also removes its images from Storage (DB trigger +
  a direct storage cleanup in the admin panel).

Change the window by editing the `interval '60 days'` inside the
`delete_stale_sold_products` function in `sql/schema.sql`, then re-running it.

---

## 🔧 Customization cheatsheet

| Want to change… | Where |
|---|---|
| Currency label | `CURRENCY` in `js/config.js` |
| Messenger link | `FACEBOOK_PAGE` in `js/config.js` |
| Compression target size | `TARGET_MIN` / `TARGET_MAX` in `js/compress.js` |
| Auto-delete window | `interval '60 days'` in `sql/schema.sql` |
| Colors / layout | CSS variables at the top of `css/style.css` |
