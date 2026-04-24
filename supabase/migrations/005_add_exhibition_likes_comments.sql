-- 전시관 좋아요
create table public.exhibition_likes (
  id uuid default gen_random_uuid() primary key,
  exhibition_id uuid references public.exhibitions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (exhibition_id, user_id)
);

-- 전시관 댓글
create table public.exhibition_comments (
  id uuid default gen_random_uuid() primary key,
  exhibition_id uuid references public.exhibitions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

create index idx_exhibition_likes_exhibition on public.exhibition_likes(exhibition_id);
create index idx_exhibition_comments_exhibition on public.exhibition_comments(exhibition_id);

alter table public.exhibition_likes enable row level security;
alter table public.exhibition_comments enable row level security;

create policy "ex_likes_select" on public.exhibition_likes for select using (true);
create policy "ex_likes_insert" on public.exhibition_likes for insert with check (auth.uid() = user_id);
create policy "ex_likes_delete" on public.exhibition_likes for delete using (auth.uid() = user_id);

create policy "ex_comments_select" on public.exhibition_comments for select using (true);
create policy "ex_comments_insert" on public.exhibition_comments for insert with check (auth.uid() = user_id);
create policy "ex_comments_delete" on public.exhibition_comments for delete using (auth.uid() = user_id);
