-- =========================
-- 작품 좋아요
-- =========================

create table public.artwork_likes (
  id uuid default gen_random_uuid() primary key,
  artwork_id uuid references public.artworks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (artwork_id, user_id)
);

-- =========================
-- 작품 댓글
-- =========================

create table public.artwork_comments (
  id uuid default gen_random_uuid() primary key,
  artwork_id uuid references public.artworks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- Indexes
create index idx_artwork_likes_artwork on public.artwork_likes(artwork_id);
create index idx_artwork_likes_user on public.artwork_likes(user_id);
create index idx_artwork_comments_artwork on public.artwork_comments(artwork_id);

-- RLS
alter table public.artwork_likes enable row level security;
alter table public.artwork_comments enable row level security;

create policy "likes_select" on public.artwork_likes for select using (true);
create policy "likes_insert" on public.artwork_likes for insert with check (auth.uid() = user_id);
create policy "likes_delete" on public.artwork_likes for delete using (auth.uid() = user_id);

create policy "comments_select" on public.artwork_comments for select using (true);
create policy "comments_insert" on public.artwork_comments for insert with check (auth.uid() = user_id);
create policy "comments_delete" on public.artwork_comments for delete using (auth.uid() = user_id);
