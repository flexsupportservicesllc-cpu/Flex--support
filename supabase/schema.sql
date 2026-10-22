-- Run in the CLIENT'S Supabase project only.
create extension if not exists pgcrypto;
create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 paid_at timestamptz,
 method text not null check(method in ('cashapp','paypal','venmo','zelle')),
 status text not null default 'pending' check(status in ('pending','paid','expired','failed','refunded')),
 amount_cents integer not null check(amount_cents between 100 and 10000000),
 currency text not null default 'USD',
 customer_name text not null,
 customer_email text not null,
 service_description text not null,
 reference text,
 provider_order_id text unique,
 provider_capture_id text unique
);
create index if not exists payments_created_at_idx on public.payments(created_at desc);
alter table public.payments enable row level security;
-- No anon/authenticated policies: ONLY server-side service-role endpoints can access customer payments.
