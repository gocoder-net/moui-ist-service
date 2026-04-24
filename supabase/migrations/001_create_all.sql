-- ============================================================
-- MOUI-IST 전체 스키마 (통합)
-- 000_drop_all.sql 실행 후 Supabase Dashboard → SQL Editor 에서 실행
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
  phone_number text,
  bio text,
  field text,
  sns_links jsonb default '{}',
  avatar_url text,
  region text,
  points integer not null default 0,
  verified boolean not null default false,
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
  wall_images jsonb not null default '{}',
  bgm_url text,
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

-- 포인트 내역
create table public.point_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount integer not null,
  balance integer not null,
  type text not null,
  description text not null,
  created_at timestamptz default now()
);

-- 모의(협업) 게시판
create table public.moui_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  fields text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz default now() not null
);

-- 출석 체크
create table public.attendance (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_date date not null default current_date,
  day_number int not null,
  reward int not null,
  created_at timestamptz default now() not null,
  unique (user_id, checked_date)
);

-- 채팅 요청
create table public.chat_requests (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  message text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now()
);

-- 채팅 메시지
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  request_id uuid references public.chat_requests(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
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
create index idx_point_history_user on public.point_history(user_id, created_at desc);
create index idx_chat_requests_receiver on public.chat_requests(receiver_id);
create index idx_chat_requests_sender on public.chat_requests(sender_id);
create index idx_chat_messages_request on public.chat_messages(request_id);

-- =========================
-- 3. RLS
-- =========================

alter table public.profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.follows enable row level security;
alter table public.exhibitions enable row level security;
alter table public.exhibition_artworks enable row level security;
alter table public.point_history enable row level security;
alter table public.moui_posts enable row level security;
alter table public.attendance enable row level security;
alter table public.chat_requests enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Artworks
create policy "artworks_select" on public.artworks for select using (true);
create policy "artworks_insert" on public.artworks for insert with check (auth.uid() = user_id);
create policy "artworks_update" on public.artworks for update using (auth.uid() = user_id);
create policy "artworks_delete" on public.artworks for delete using (auth.uid() = user_id);

-- Follows
create policy "follows_select" on public.follows for select using (true);
create policy "follows_insert" on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_delete" on public.follows for delete using (auth.uid() = follower_id);

-- Exhibitions
create policy "exhibitions_select" on public.exhibitions for select using (is_published = true or auth.uid() = user_id);
create policy "exhibitions_insert" on public.exhibitions for insert with check (auth.uid() = user_id);
create policy "exhibitions_update" on public.exhibitions for update using (auth.uid() = user_id);
create policy "exhibitions_delete" on public.exhibitions for delete using (auth.uid() = user_id);

-- Exhibition Artworks
create policy "exhibition_artworks_select" on public.exhibition_artworks
  for select using (exists (select 1 from public.exhibitions e where e.id = exhibition_id and (e.is_published = true or e.user_id = auth.uid())));
create policy "exhibition_artworks_insert" on public.exhibition_artworks
  for insert with check (exists (select 1 from public.exhibitions e where e.id = exhibition_id and e.user_id = auth.uid()));
create policy "exhibition_artworks_update" on public.exhibition_artworks
  for update using (exists (select 1 from public.exhibitions e where e.id = exhibition_id and e.user_id = auth.uid()));
create policy "exhibition_artworks_delete" on public.exhibition_artworks
  for delete using (exists (select 1 from public.exhibitions e where e.id = exhibition_id and e.user_id = auth.uid()));

-- Point History
create policy "Users can view own point history" on public.point_history for select using (auth.uid() = user_id);
create policy "Users can insert own point history" on public.point_history for insert with check (auth.uid() = user_id);

-- Moui Posts
create policy "Anyone can read moui_posts" on public.moui_posts for select using (true);
create policy "Authenticated users can insert moui_posts" on public.moui_posts for insert with check (auth.uid() = user_id);
create policy "Users can update own moui_posts" on public.moui_posts for update using (auth.uid() = user_id);

-- Attendance
create policy "Users can read own attendance" on public.attendance for select using (auth.uid() = user_id);
create policy "Users can insert own attendance" on public.attendance for insert with check (auth.uid() = user_id);

-- Chat Requests
create policy "chat_requests_select" on public.chat_requests for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "chat_requests_insert" on public.chat_requests for insert with check (auth.uid() = sender_id);
create policy "chat_requests_update" on public.chat_requests for update using (auth.uid() = receiver_id);
create policy "chat_requests_delete" on public.chat_requests for delete using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Chat Messages
create policy "chat_messages_select" on public.chat_messages for select using (
  exists (select 1 from public.chat_requests r where r.id = request_id and (r.sender_id = auth.uid() or r.receiver_id = auth.uid()))
);
create policy "chat_messages_insert" on public.chat_messages for insert with check (
  auth.uid() = sender_id and exists (select 1 from public.chat_requests r where r.id = request_id and r.status = 'accepted' and (r.sender_id = auth.uid() or r.receiver_id = auth.uid()))
);
create policy "chat_messages_delete" on public.chat_messages for delete using (
  exists (select 1 from public.chat_requests r where r.id = request_id and (r.sender_id = auth.uid() or r.receiver_id = auth.uid()))
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

create trigger on_profiles_updated before update on public.profiles for each row execute function public.handle_updated_at();
create trigger on_artworks_updated before update on public.artworks for each row execute function public.handle_updated_at();
create trigger on_exhibitions_updated before update on public.exhibitions for each row execute function public.handle_updated_at();

-- =========================
-- 5. Auto-create profile on signup
-- =========================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, points)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    50
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

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('artworks', 'artworks', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('bgm', 'bgm', true) on conflict (id) do nothing;

-- Storage RLS: avatars
create policy "avatars_select" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_insert" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "avatars_update" on storage.objects for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatars_delete" on storage.objects for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Storage RLS: artworks
create policy "artworks_storage_select" on storage.objects for select using (bucket_id = 'artworks');
create policy "artworks_storage_insert" on storage.objects for insert with check (bucket_id = 'artworks' and auth.role() = 'authenticated');
create policy "artworks_storage_update" on storage.objects for update using (bucket_id = 'artworks' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "artworks_storage_delete" on storage.objects for delete using (bucket_id = 'artworks' and auth.uid()::text = (storage.foldername(name))[1]);

-- Storage RLS: bgm
create policy "bgm_select" on storage.objects for select using (bucket_id = 'bgm');
create policy "bgm_insert" on storage.objects for insert with check (bucket_id = 'bgm' and auth.role() = 'authenticated');
create policy "bgm_update" on storage.objects for update using (bucket_id = 'bgm' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "bgm_delete" on storage.objects for delete using (bucket_id = 'bgm' and auth.uid()::text = (storage.foldername(name))[1]);


ALTER TABLE moui_posts
    ADD COLUMN frequency text,
    ADD COLUMN recruit_deadline timestamptz;

ALTER TABLE moui_posts
    ADD COLUMN address text,
    ADD COLUMN recruit_start timestamptz;


ALTER TABLE moui_posts
    ADD COLUMN target_types text,
    ADD COLUMN map_url text,
    ADD COLUMN meeting_date timestamptz,
    ADD COLUMN address text,
    ADD COLUMN frequency text,
    ADD COLUMN recruit_start timestamptz,
    ADD COLUMN recruit_deadline timestamptz;



ALTER TABLE moui_posts
    ADD COLUMN category text,
    ADD COLUMN region text;

-- 모임 참석자
CREATE TABLE public.moui_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  moui_post_id uuid NOT NULL REFERENCES public.moui_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(moui_post_id, user_id)
);

ALTER TABLE public.moui_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read moui_participants"
  ON public.moui_participants FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert moui_participants"
  ON public.moui_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own moui_participants"
  ON public.moui_participants FOR DELETE USING (auth.uid() = user_id);

-- 모임 채팅 메시지
CREATE TABLE public.moui_chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  moui_post_id uuid NOT NULL REFERENCES public.moui_posts(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.moui_chat_messages ENABLE ROW LEVEL SECURITY;

-- 참여자만 읽기 (참여자 or 작성자)
CREATE POLICY "Participants can read moui_chat_messages"
  ON public.moui_chat_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.moui_participants mp WHERE mp.moui_post_id = moui_chat_messages.moui_post_id AND mp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.moui_posts p WHERE p.id = moui_chat_messages.moui_post_id AND p.user_id = auth.uid())
  );
-- 참여자/작성자만 쓰기
CREATE POLICY "Participants can insert moui_chat_messages"
  ON public.moui_chat_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (
      EXISTS (SELECT 1 FROM public.moui_participants mp WHERE mp.moui_post_id = moui_chat_messages.moui_post_id AND mp.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.moui_posts p WHERE p.id = moui_chat_messages.moui_post_id AND p.user_id = auth.uid())
    )
  );

-- =========================
-- Realtime 활성화
-- =========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.moui_chat_messages;

-- 작가 인증 요청
CREATE TABLE public.verification_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verification_requests_select" ON public.verification_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "verification_requests_insert" ON public.verification_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER on_verification_requests_updated
  BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 관리자가 모든 인증 요청 조회 가능
CREATE POLICY "admin_verification_requests_select" ON public.verification_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND username = 'gocoder')
  );

-- 인증 승인 RPC
CREATE OR REPLACE FUNCTION public.admin_approve_verification(request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = 'gocoder') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT user_id INTO v_user_id FROM verification_requests WHERE id = request_id;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  UPDATE verification_requests SET status = 'approved' WHERE id = request_id;
  UPDATE profiles SET verified = true WHERE id = v_user_id;
END; $$;

-- 인증 반려 RPC
CREATE OR REPLACE FUNCTION public.admin_reject_verification(request_id uuid, note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND username = 'gocoder') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE verification_requests SET status = 'rejected', admin_note = note WHERE id = request_id;
END; $$;

-- =========================
-- 채팅 자동 삭제 + 기간 연장
-- =========================

ALTER TABLE public.chat_requests
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN extended boolean NOT NULL DEFAULT false;

-- 기존 accepted 채팅에 만료일 설정 (7일 후)
UPDATE public.chat_requests
  SET expires_at = created_at + interval '7 days'
  WHERE status = 'accepted' AND expires_at IS NULL;

-- 채팅 기간 연장 RPC (100 MOUI 차감, 1회 제한, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.extend_chat(request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_extended boolean;
  v_expires timestamptz;
  v_user_id uuid := auth.uid();
  v_points integer;
BEGIN
  SELECT extended, expires_at INTO v_extended, v_expires
    FROM chat_requests WHERE id = request_id
    AND (sender_id = v_user_id OR receiver_id = v_user_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Chat not found'; END IF;
  IF v_extended THEN RAISE EXCEPTION 'Already extended'; END IF;

  SELECT points INTO v_points FROM profiles WHERE id = v_user_id;
  IF v_points < 100 THEN RAISE EXCEPTION 'Not enough points'; END IF;

  UPDATE profiles SET points = points - 100 WHERE id = v_user_id;
  INSERT INTO point_history (user_id, amount, balance, type, description)
    VALUES (v_user_id, -100, v_points - 100, 'chat_extend', '채팅 기간 연장');

  UPDATE chat_requests
    SET expires_at = COALESCE(expires_at, now()) + interval '7 days',
        extended = true
    WHERE id = request_id;
END; $$;

-- =========================
-- 채팅 읽음 추적
-- =========================

ALTER TABLE public.chat_requests
  ADD COLUMN sender_last_read_at timestamptz,
  ADD COLUMN receiver_last_read_at timestamptz;

-- 채팅 읽음 표시 RPC (sender/receiver 모두 호출 가능)
CREATE OR REPLACE FUNCTION public.mark_chat_read(request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sender_id uuid;
  v_receiver_id uuid;
BEGIN
  SELECT sender_id, receiver_id INTO v_sender_id, v_receiver_id
    FROM chat_requests WHERE id = request_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_user_id = v_sender_id THEN
    UPDATE chat_requests SET sender_last_read_at = now() WHERE id = request_id;
  ELSIF v_user_id = v_receiver_id THEN
    UPDATE chat_requests SET receiver_last_read_at = now() WHERE id = request_id;
  END IF;
END; $$;
