-- Маленький музей: схема базы и хранилища.
-- Выполните целиком в Supabase → SQL Editor (или `supabase db push`).

-- ——— Кто имеет доступ ———
-- Доступ только у почт из этой таблицы, даже если кто-то зарегистрируется сам.
create table if not exists public.family (
  email text primary key
);

create or replace function public.is_family()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

-- ——— Дети ———
create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'blue',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.children (name, color, sort)
select * from (values ('Кирилл', 'blue', 0), ('Марк', 'green', 1)) as v(name, color, sort)
where not exists (select 1 from public.children);

-- ——— Коллекции ———
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'pink',
  created_at timestamptz not null default now()
);

-- ——— Работы ———
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('drawing', 'craft')),
  title text not null default '',
  child_id uuid references public.children (id) on delete set null,
  collection_id uuid references public.collections (id) on delete set null,
  made_on date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  image_path text not null,
  thumb_path text not null,
  aspect real not null default 0.75,
  photo_paths text[] not null default '{}',
  model_path text,
  model_status text not null default 'none' check (model_status in ('none', 'processing', 'ready', 'failed')),
  model_task_id text,
  model_error text,
  notes text not null default ''
);

create index if not exists artworks_made_on_idx on public.artworks (made_on desc);
create index if not exists artworks_child_idx on public.artworks (child_id);
create index if not exists artworks_collection_idx on public.artworks (collection_id);

-- ——— Права ———
alter table public.family enable row level security;
alter table public.children enable row level security;
alter table public.collections enable row level security;
alter table public.artworks enable row level security;

drop policy if exists "family reads family" on public.family;
create policy "family reads family" on public.family
  for select to authenticated using (public.is_family());

drop policy if exists "family manages children" on public.children;
create policy "family manages children" on public.children
  for all to authenticated using (public.is_family()) with check (public.is_family());

drop policy if exists "family manages collections" on public.collections;
create policy "family manages collections" on public.collections
  for all to authenticated using (public.is_family()) with check (public.is_family());

drop policy if exists "family manages artworks" on public.artworks;
create policy "family manages artworks" on public.artworks
  for all to authenticated using (public.is_family()) with check (public.is_family());

-- ——— Хранилище файлов (приватное) ———
insert into storage.buckets (id, name, public)
values ('art', 'art', false)
on conflict (id) do nothing;

drop policy if exists "family reads art" on storage.objects;
create policy "family reads art" on storage.objects
  for select to authenticated using (bucket_id = 'art' and public.is_family());

drop policy if exists "family uploads art" on storage.objects;
create policy "family uploads art" on storage.objects
  for insert to authenticated with check (bucket_id = 'art' and public.is_family());

drop policy if exists "family updates art" on storage.objects;
create policy "family updates art" on storage.objects
  for update to authenticated using (bucket_id = 'art' and public.is_family());

drop policy if exists "family deletes art" on storage.objects;
create policy "family deletes art" on storage.objects
  for delete to authenticated using (bucket_id = 'art' and public.is_family());
