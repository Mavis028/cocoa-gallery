-- Cocoa Gallery — database setup for Supabase
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a new project.

-- ---------- Admins (who may use the dashboard) ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create policy "admins can see admins" on public.admins for select to authenticated using (public.is_admin());

-- ---------- Products ----------
create table if not exists public.products (
  id          text primary key,
  name        text not null check (char_length(name) between 1 and 80),
  type        text check (char_length(type) <= 40),
  description text check (char_length(description) <= 400),
  in_stock    boolean not null default true,
  visible     boolean not null default true,
  sort        int not null default 0,
  photo_url   text check (char_length(photo_url) <= 500),
  updated_at  timestamptz not null default now()
);
alter table public.products enable row level security;
create policy "anyone can read products" on public.products for select to anon, authenticated using (true);
create policy "admins insert products"  on public.products for insert to authenticated with check (public.is_admin());
create policy "admins update products"  on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete products"  on public.products for delete to authenticated using (public.is_admin());

-- ---------- Settings (box sizes & prices) ----------
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);
alter table public.settings enable row level security;
create policy "anyone can read settings" on public.settings for select to anon, authenticated using (true);
create policy "admins write settings"    on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Orders ----------
create table if not exists public.orders (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  phone         text not null check (char_length(phone) between 6 and 20),
  address       text check (char_length(address) <= 300),
  notes         text check (char_length(notes) <= 500),
  box_size      int  not null check (box_size between 1 and 60),
  items         jsonb not null,
  total         numeric check (total >= 0),
  status        text not null default 'new' check (status in ('new','preparing','ready','delivered','cancelled'))
);
alter table public.orders enable row level security;
-- customers can place an order but can never read anyone's orders
create policy "customers place orders" on public.orders for insert to anon, authenticated with check (status = 'new');
create policy "admins read orders"     on public.orders for select to authenticated using (public.is_admin());
create policy "admins update orders"   on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete orders"   on public.orders for delete to authenticated using (public.is_admin());

-- ---------- Visits (no personal data: just time, page, where from, phone/desktop) ----------
create table if not exists public.visits (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path       text check (char_length(path) <= 200),
  referrer   text check (char_length(referrer) <= 200),
  device     text check (device in ('mobile','desktop'))
);
alter table public.visits enable row level security;
create policy "anyone records a visit" on public.visits for insert to anon, authenticated with check (true);
create policy "admins read visits"     on public.visits for select to authenticated using (public.is_admin());

-- ---------- Product photos (Storage) ----------
insert into storage.buckets (id, name, public) values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;
create policy "anyone views product photos" on storage.objects for select to anon, authenticated using (bucket_id = 'product-photos');
create policy "admins upload product photos" on storage.objects for insert to authenticated with check (bucket_id = 'product-photos' and public.is_admin());
create policy "admins change product photos" on storage.objects for update to authenticated using (bucket_id = 'product-photos' and public.is_admin());
create policy "admins delete product photos" on storage.objects for delete to authenticated using (bucket_id = 'product-photos' and public.is_admin());

-- ---------- Make yourself the admin ----------
-- 1) Supabase → Authentication → Users → Add user (your email + a strong password).
-- 2) Then run this line with that email:
-- insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
