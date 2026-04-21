-- ============================================================
-- MOUI-IST Full Schema (통합)
-- Run after 000_drop_all.sql in Supabase Dashboard → SQL Editor
-- ============================================================

-- =========================
-- 1. Tables
-- =========================

-- 프로필
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  user_type text not null default 'audience' check (user_type in ('creator', 'aspiring', 'audience')),
  name text,
  real_name text,
  bio text,
  field text,
  sns_links jsonb default '{}',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 작품
create table public.artworks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  year integer,
  medium text,
  width_cm numeric,
  height_cm numeric,
  edition text,
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

-- 팔로우
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id != following_id)
);

-- 전시관
create table public.exhibitions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  foreword text,
  room_type text not null default 'medium' check (room_type in ('small', 'medium', 'large', 'wide')),
  wall_color_north text not null default '#F5F5F0',
  wall_color_south text not null default '#F5F5F0',
  wall_color_east text not null default '#F5F5F0',
  wall_color_west text not null default '#F5F5F0',
  floor_color text not null default '#8B7355',
  ceiling_color text not null default '#F5F5F0',
  poster_image_url text,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 전시관 배치 작품
create table public.exhibition_artworks (
  id uuid default gen_random_uuid() primary key,
  exhibition_id uuid references public.exhibitions(id) on delete cascade not null,
  artwork_id uuid references public.artworks(id) on delete cascade not null,
  wall text not null check (wall in ('north', 'south', 'east', 'west')),
  position_x numeric not null default 300,
  position_y numeric not null default 150,
  width_cm numeric not null default 60,
  height_cm numeric not null default 40,
  created_at timestamptz default now()
);

-- =========================
-- 2. Indexes
-- =========================

create index idx_artworks_user_id on public.artworks(user_id);
create index idx_artworks_tags on public.artworks using gin(tags);
create index idx_follows_following_id on public.follows(following_id);
create index idx_exhibitions_user_id on public.exhibitions(user_id);
create index idx_exhibitions_published on public.exhibitions(is_published) where is_published = true;
create index idx_exhibition_artworks_exhibition_id on public.exhibition_artworks(exhibition_id);

-- =========================
-- 3. RLS
-- =========================

alter table public.profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.follows enable row level security;
alter table public.exhibitions enable row level security;
alter table public.exhibition_artworks enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles
  for select using (true);

create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id);

-- Artworks
create policy "artworks_select" on public.artworks
  for select using (true);

create policy "artworks_insert" on public.artworks
  for insert with check (auth.uid() = user_id);

create policy "artworks_update" on public.artworks
  for update using (auth.uid() = user_id);

create policy "artworks_delete" on public.artworks
  for delete using (auth.uid() = user_id);

-- Follows
create policy "follows_select" on public.follows
  for select using (true);

create policy "follows_insert" on public.follows
  for insert with check (auth.uid() = follower_id);

create policy "follows_delete" on public.follows
  for delete using (auth.uid() = follower_id);

-- Exhibitions
create policy "exhibitions_select" on public.exhibitions
  for select using (is_published = true or auth.uid() = user_id);

create policy "exhibitions_insert" on public.exhibitions
  for insert with check (auth.uid() = user_id);

create policy "exhibitions_update" on public.exhibitions
  for update using (auth.uid() = user_id);

create policy "exhibitions_delete" on public.exhibitions
  for delete using (auth.uid() = user_id);

-- Exhibition Artworks
create policy "exhibition_artworks_select" on public.exhibition_artworks
  for select using (
    exists (
      select 1 from public.exhibitions e
      where e.id = exhibition_id
      and (e.is_published = true or e.user_id = auth.uid())
    )
  );

create policy "exhibition_artworks_insert" on public.exhibition_artworks
  for insert with check (
    exists (
      select 1 from public.exhibitions e
      where e.id = exhibition_id and e.user_id = auth.uid()
    )
  );

create policy "exhibition_artworks_update" on public.exhibition_artworks
  for update using (
    exists (
      select 1 from public.exhibitions e
      where e.id = exhibition_id and e.user_id = auth.uid()
    )
  );

create policy "exhibition_artworks_delete" on public.exhibition_artworks
  for delete using (
    exists (
      select 1 from public.exhibitions e
      where e.id = exhibition_id and e.user_id = auth.uid()
    )
  );

-- =========================
-- 4. Triggers
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

create trigger on_exhibitions_updated
  before update on public.exhibitions
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
