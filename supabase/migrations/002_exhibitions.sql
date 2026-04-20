-- ============================================================
-- MOUI-IST Exhibition Schema
-- 가상 전시관 - 실측 기반 (미터/센치)
-- ============================================================

-- =========================
-- 1. Tables
-- =========================

-- 전시관
create table public.exhibitions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  -- 전시 서문 (입구에서 보이는 소개글)
  foreword text,
  -- 전시관 타입: small(6x4m), medium(10x7m), large(15x10m), wide(20x8m)
  room_type text not null default 'medium' check (room_type in ('small', 'medium', 'large', 'wide')),
  -- 벽 색상 (4면)
  wall_color_north text not null default '#F5F5F0',
  wall_color_south text not null default '#F5F5F0',
  wall_color_east text not null default '#F5F5F0',
  wall_color_west text not null default '#F5F5F0',
  floor_color text not null default '#8B7355',
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 전시관에 배치된 작품
create table public.exhibition_artworks (
  id uuid default gen_random_uuid() primary key,
  exhibition_id uuid references public.exhibitions(id) on delete cascade not null,
  artwork_id uuid references public.artworks(id) on delete cascade not null,
  -- 어느 벽
  wall text not null check (wall in ('north', 'south', 'east', 'west')),
  -- 벽면 왼쪽 끝에서의 거리 (cm) - 작품 중심 기준
  position_x numeric not null default 300,
  -- 바닥에서의 높이 (cm) - 작품 중심 기준 (보통 150cm = 눈높이)
  position_y numeric not null default 150,
  -- 작품 가로 크기 (cm)
  width_cm numeric not null default 60,
  -- 작품 세로 크기 (cm)
  height_cm numeric not null default 40,
  created_at timestamptz default now()
);

-- =========================
-- 2. Indexes
-- =========================

create index idx_exhibitions_user_id on public.exhibitions(user_id);
create index idx_exhibitions_published on public.exhibitions(is_published) where is_published = true;
create index idx_exhibition_artworks_exhibition_id on public.exhibition_artworks(exhibition_id);

-- =========================
-- 3. RLS
-- =========================

alter table public.exhibitions enable row level security;
alter table public.exhibition_artworks enable row level security;

create policy "exhibitions_select" on public.exhibitions
  for select using (is_published = true or auth.uid() = user_id);

create policy "exhibitions_insert" on public.exhibitions
  for insert with check (auth.uid() = user_id);

create policy "exhibitions_update" on public.exhibitions
  for update using (auth.uid() = user_id);

create policy "exhibitions_delete" on public.exhibitions
  for delete using (auth.uid() = user_id);

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
-- 4. updated_at trigger
-- =========================

create trigger on_exhibitions_updated
  before update on public.exhibitions
  for each row execute function public.handle_updated_at();
