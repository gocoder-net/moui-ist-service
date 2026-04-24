-- =========================
-- 작품 컬렉션 (시리즈)
-- =========================

create table public.artwork_collections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  cover_image_url text,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 컬렉션 ↔ 작품 (다대다)
create table public.collection_artworks (
  id uuid default gen_random_uuid() primary key,
  collection_id uuid references public.artwork_collections(id) on delete cascade not null,
  artwork_id uuid references public.artworks(id) on delete cascade not null,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  unique (collection_id, artwork_id)
);

-- Indexes
create index idx_artwork_collections_user on public.artwork_collections(user_id);
create index idx_collection_artworks_collection on public.collection_artworks(collection_id);
create index idx_collection_artworks_artwork on public.collection_artworks(artwork_id);

-- RLS
alter table public.artwork_collections enable row level security;
alter table public.collection_artworks enable row level security;

create policy "collections_select" on public.artwork_collections for select using (true);
create policy "collections_insert" on public.artwork_collections for insert with check (auth.uid() = user_id);
create policy "collections_update" on public.artwork_collections for update using (auth.uid() = user_id);
create policy "collections_delete" on public.artwork_collections for delete using (auth.uid() = user_id);

create policy "collection_artworks_select" on public.collection_artworks
  for select using (exists (select 1 from public.artwork_collections c where c.id = collection_id));
create policy "collection_artworks_insert" on public.collection_artworks
  for insert with check (exists (select 1 from public.artwork_collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy "collection_artworks_update" on public.collection_artworks
  for update using (exists (select 1 from public.artwork_collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy "collection_artworks_delete" on public.collection_artworks
  for delete using (exists (select 1 from public.artwork_collections c where c.id = collection_id and c.user_id = auth.uid()));

-- Trigger
create trigger on_artwork_collections_updated before update on public.artwork_collections for each row execute function public.handle_updated_at();
