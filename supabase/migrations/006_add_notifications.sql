create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('like', 'comment', 'follow', 'chat_request', 'chat_accepted', 'moui_join')),
  title text not null,
  body text,
  from_user_id uuid references public.profiles(id) on delete set null,
  target_id text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index idx_notifications_user on public.notifications(user_id, created_at desc);
create index idx_notifications_unread on public.notifications(user_id) where is_read = false;

alter table public.notifications enable row level security;

create policy "notifications_select" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_insert" on public.notifications for insert with check (true);
create policy "notifications_update" on public.notifications for update using (auth.uid() = user_id);
create policy "notifications_delete" on public.notifications for delete using (auth.uid() = user_id);
