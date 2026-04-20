-- ============================================================
-- MOUI-IST Initial Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- =========================
-- 1. Tables
-- =========================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  user_type text not null default 'audience' check (user_type in ('creator', 'aspiring', 'audience')),
  name text,
  bio text,
  field text,
  sns_links jsonb default '{}',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.artworks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  image_url text not null,
  image_top_url text,
  image_bottom_url text,
  image_left_url text,
  image_right_url text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id != following_id)
);

-- =========================
-- 2. Indexes
-- =========================

create index idx_artworks_user_id on public.artworks(user_id);
create index idx_artworks_tags on public.artworks using gin(tags);
create index idx_follows_following_id on public.follows(following_id);

-- =========================
-- 3. RLS (Row Level Security)
-- =========================

alter table public.profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.follows enable row level security;

create policy "profiles_select" on public.profiles
  for select using (true);

create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id);

create policy "artworks_select" on public.artworks
  for select using (true);

create policy "artworks_insert" on public.artworks
  for insert with check (auth.uid() = user_id);

create policy "artworks_update" on public.artworks
  for update using (auth.uid() = user_id);

create policy "artworks_delete" on public.artworks
  for delete using (auth.uid() = user_id);

create policy "follows_select" on public.follows
  for select using (true);

create policy "follows_insert" on public.follows
  for insert with check (auth.uid() = follower_id);

create policy "follows_delete" on public.follows
  for delete using (auth.uid() = follower_id);

-- =========================
-- 4. updated_at auto-update trigger
-- =========================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger on_artworks_updated
  before update on public.artworks
  for each row execute function public.handle_updated_at();

-- =========================
-- 5. Auto-create profile on signup
-- =========================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- 6. Storage Buckets
-- =========================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('artworks', 'artworks', true)
on conflict (id) do nothing;

-- Storage RLS: avatars
create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
  );

create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS: artworks
create policy "artworks_storage_select" on storage.objects
  for select using (bucket_id = 'artworks');

create policy "artworks_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'artworks'
    and auth.role() = 'authenticated'
  );

create policy "artworks_storage_update" on storage.objects
  for update using (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "artworks_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'artworks'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
