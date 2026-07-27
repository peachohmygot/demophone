-- =====================================================================
--  PHONE CATALOG — Supabase schema
--  Run this whole file ONCE in:  Supabase Dashboard → SQL Editor → New query
-- =====================================================================
--  It creates:
--    • brands, models, products tables
--    • Row Level Security (public read / admin write)
--    • a trigger that stamps `sold_at` when a product is marked Sold Out
--    • a storage bucket "product-images" (public read / admin write)
--    • an auto-delete job for products sold for more than 60 days
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists pg_cron;        -- scheduled auto-delete


-- ---------------------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------------------

-- Brands ---------------------------------------------------------------
create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- Models (each model belongs to one brand) -----------------------------
create table if not exists public.models (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brands(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (brand_id, name)
);

-- Products -------------------------------------------------------------
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  brand_id          uuid references public.brands(id) on delete set null,
  model_id          uuid references public.models(id) on delete set null,
  description        text default '',
  original_price     numeric(12,2) not null default 0,   -- price before discount
  sale_price         numeric(12,2) not null default 0,    -- current selling price
  release_year       int,                                 -- model year
  condition_percent  int  not null default 100
                     check (condition_percent between 0 and 100),
  image_paths        text[] not null default '{}',        -- storage object paths (max 7)
  is_hot_hit         boolean not null default false,
  is_sold            boolean not null default false,
  sold_at            timestamptz,                         -- set when is_sold flips to true
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_products_brand   on public.products (brand_id);
create index if not exists idx_products_model   on public.products (model_id);
create index if not exists idx_products_sold     on public.products (is_sold);
create index if not exists idx_products_hot       on public.products (is_hot_hit);
create index if not exists idx_products_created on public.products (created_at desc);


-- ---------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------

-- Keep updated_at fresh, and stamp/clear sold_at when is_sold changes.
create or replace function public.products_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if new.is_sold then
      new.sold_at := coalesce(new.sold_at, now());
    else
      new.sold_at := null;
    end if;

  elsif tg_op = 'UPDATE' then
    if new.is_sold and not old.is_sold then
      new.sold_at := now();          -- just became sold
    elsif not new.is_sold and old.is_sold then
      new.sold_at := null;           -- back in stock
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_before_write on public.products;
create trigger trg_products_before_write
  before insert or update on public.products
  for each row execute function public.products_before_write();


-- When a product row is removed, also remove its images from storage
-- so we don't leave orphaned files behind.
create or replace function public.products_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.image_paths is not null and array_length(old.image_paths, 1) > 0 then
    delete from storage.objects
    where bucket_id = 'product-images'
      and name = any(old.image_paths);
  end if;
  return old;
end;
$$;

drop trigger if exists trg_products_after_delete on public.products;
create trigger trg_products_after_delete
  after delete on public.products
  for each row execute function public.products_after_delete();


-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--    Anyone (anon) can read. Only logged-in admins can write.
-- ---------------------------------------------------------------------
alter table public.brands   enable row level security;
alter table public.models   enable row level security;
alter table public.products enable row level security;

-- brands
drop policy if exists "brands public read"  on public.brands;
drop policy if exists "brands admin write"  on public.brands;
create policy "brands public read" on public.brands
  for select using (true);
create policy "brands admin write" on public.brands
  for all to authenticated using (true) with check (true);

-- models
drop policy if exists "models public read"  on public.models;
drop policy if exists "models admin write"  on public.models;
create policy "models public read" on public.models
  for select using (true);
create policy "models admin write" on public.models
  for all to authenticated using (true) with check (true);

-- products
drop policy if exists "products public read" on public.products;
drop policy if exists "products admin write" on public.products;
create policy "products public read" on public.products
  for select using (true);
create policy "products admin write" on public.products
  for all to authenticated using (true) with check (true);


-- ---------------------------------------------------------------------
-- 5. STORAGE BUCKET  (public read, admin write)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product images public read"   on storage.objects;
drop policy if exists "product images admin insert"  on storage.objects;
drop policy if exists "product images admin update"  on storage.objects;
drop policy if exists "product images admin delete"  on storage.objects;

create policy "product images public read" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "product images admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

create policy "product images admin update" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

create policy "product images admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');


-- ---------------------------------------------------------------------
-- 6. AUTO-DELETE — remove items Sold Out for more than 60 days
-- ---------------------------------------------------------------------
create or replace function public.delete_stale_sold_products()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Deleting the rows fires trg_products_after_delete, which also clears
  -- the associated images from storage.
  delete from public.products
  where is_sold = true
    and sold_at is not null
    and sold_at < now() - interval '60 days';
end;
$$;

-- Schedule it to run once a day at 03:00 UTC.
-- (unschedule first so re-running this file doesn't create duplicates)
do $$
begin
  perform cron.unschedule('delete_stale_sold_products');
exception when others then
  null;   -- job didn't exist yet
end;
$$;

select cron.schedule(
  'delete_stale_sold_products',
  '0 3 * * *',
  $$ select public.delete_stale_sold_products(); $$
);

-- =====================================================================
--  DONE.  Next: create an admin user (Authentication → Users → Add user)
--  and fill in js/config.js with your project URL + anon key.
-- =====================================================================
