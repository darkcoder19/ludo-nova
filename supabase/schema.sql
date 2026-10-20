-- LudoNova players. Run once in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.ludo_users (
  id uuid primary key default gen_random_uuid(),
  google_sub text unique,
  email text not null unique,
  name text,
  picture text,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  plan_source text,               -- 'dodo' or 'admin'
  subscription_id text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

create index if not exists ludo_users_last_active on public.ludo_users (last_active_at desc);

-- Only the server (service-role key) touches this table; nothing is exposed to browsers.
alter table public.ludo_users enable row level security;
