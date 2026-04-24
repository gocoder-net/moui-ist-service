-- =========================
-- 아카이브(컬렉션) 좋아요
-- =========================

create table public.collection_likes (
  id uuid default gen_random_uuid() primary key,
  collection_id uuid references public.artwork_collections(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (collection_id, user_id)
);

-- =========================
-- 아카이브(컬렉션) 댓글
-- =========================

create table public.collection_comments (
  id uuid default gen_random_uuid() primary key,
  collection_id uuid references public.artwork_collections(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- Indexes
create index idx_collection_likes_collection on public.collection_likes(collection_id);
create index idx_collection_comments_collection on public.collection_comments(collection_id);

-- RLS
alter table public.collection_likes enable row level security;
alter table public.collection_comments enable row level security;

create policy "col_likes_select" on public.collection_likes for select using (true);
create policy "col_likes_insert" on public.collection_likes for insert with check (auth.uid() = user_id);
create policy "col_likes_delete" on public.collection_likes for delete using (auth.uid() = user_id);

create policy "col_comments_select" on public.collection_comments for select using (true);
create policy "col_comments_insert" on public.collection_comments for insert with check (auth.uid() = user_id);
create policy "col_comments_delete" on public.collection_comments for delete using (auth.uid() = user_id);
