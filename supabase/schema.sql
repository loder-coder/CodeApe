create extension if not exists "pgcrypto";

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  board text not null,
  title text not null,
  body text not null,
  file_ext text not null default 'js',
  author_hash text not null,
  ip_hash text not null,
  report_count integer not null default 0,
  is_deleted boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.posts add column if not exists is_hidden boolean not null default false;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  body text not null,
  author_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_hash),
  unique (post_id, ip_hash)
);

create table if not exists public.blocked_identities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('author_hash', 'ip_hash')),
  value text not null unique,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.forbidden_words (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  post_id uuid references public.posts(id) on delete set null,
  author_hash text,
  ip_hash text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists posts_board_created_at_idx on public.posts (board, created_at desc);
create index if not exists posts_author_created_at_idx on public.posts (author_hash, created_at desc);
create index if not exists posts_ip_created_at_idx on public.posts (ip_hash, created_at desc);
create index if not exists comments_post_created_at_idx on public.comments (post_id, created_at asc);
create index if not exists comments_author_created_at_idx on public.comments (author_hash, created_at desc);
create index if not exists comments_ip_created_at_idx on public.comments (ip_hash, created_at desc);
create index if not exists blocked_identities_value_idx on public.blocked_identities (value);
create index if not exists forbidden_words_active_idx on public.forbidden_words (is_active);
create index if not exists admin_events_created_at_idx on public.admin_events (created_at desc);

create or replace function public.get_database_size()
returns text
language sql
security definer
as $$
  select pg_size_pretty(pg_database_size(current_database()));
$$;
