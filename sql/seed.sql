-- =====================================================================
--  OPTIONAL SAMPLE DATA — run AFTER schema.sql to see the catalog populated.
--  (Products created here have no images; add real ones via the admin panel.)
-- =====================================================================

insert into public.brands (name) values
  ('Apple'), ('Samsung'), ('Xiaomi')
on conflict (name) do nothing;

-- Models per brand
insert into public.models (brand_id, name)
select b.id, m.name
from public.brands b
join (values
  ('Apple',   'iPhone 13'),
  ('Apple',   'iPhone 13 Pro'),
  ('Apple',   'iPhone 14'),
  ('Samsung', 'Galaxy S22'),
  ('Samsung', 'Galaxy S23'),
  ('Xiaomi',  'Redmi Note 12')
) as m(brand, name) on b.name = m.brand
on conflict (brand_id, name) do nothing;

-- A few demo products
insert into public.products
  (title, brand_id, model_id, description, original_price, sale_price,
   release_year, condition_percent, is_hot_hit, is_sold)
select
  d.title, b.id, m.id, d.descr, d.orig, d.sale, d.year, d.cond, d.hot, d.sold
from (values
  ('iPhone 13 Pro 256GB Graphite', 'Apple',   'iPhone 13 Pro', 'Full box, battery 92%.', 32900, 24900, 2021, 95, true,  false),
  ('iPhone 13 128GB Blue',          'Apple',   'iPhone 13',     'Minor scratches on frame.', 24900, 17500, 2021, 90, false, false),
  ('iPhone 14 128GB Midnight',      'Apple',   'iPhone 14',     'Like new, warranty left.', 29900, 26900, 2022, 98, true,  false),
  ('Galaxy S23 256GB Green',        'Samsung', 'Galaxy S23',    'Excellent condition.', 27900, 21900, 2023, 96, false, false),
  ('Galaxy S22 128GB Black',        'Samsung', 'Galaxy S22',    'Screen protector applied.', 21900, 14900, 2022, 88, false, true),
  ('Redmi Note 12 128GB',           'Xiaomi',  'Redmi Note 12', 'Budget friendly, great value.', 6990, 4990, 2023, 93, false, false)
) as d(title, brand, model, descr, orig, sale, year, cond, hot, sold)
join public.brands b on b.name = d.brand
join public.models m on m.name = d.model and m.brand_id = b.id;
