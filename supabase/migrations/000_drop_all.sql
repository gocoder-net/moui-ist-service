-- ============================================================
-- MOUI-IST Drop All — 개발용 전체 초기화
-- Supabase Dashboard → SQL Editor 에서 실행
-- ============================================================

-- ========== Storage Policies ==========
drop policy if exists "bgm_delete" on storage.objects;
drop policy if exists "bgm_update" on storage.objects;
drop policy if exists "bgm_insert" on storage.objects;
drop policy if exists "bgm_select" on storage.objects;
drop policy if exists "artworks_storage_delete" on storage.objects;
drop policy if exists "artworks_storage_update" on storage.objects;
drop policy if exists "artworks_storage_insert" on storage.objects;
drop policy if exists "artworks_storage_select" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_select" on storage.objects;

-- ========== Exhibition ==========
drop policy if exists "exhibition_artworks_delete" on public.exhibition_artworks;
drop policy if exists "exhibition_artworks_update" on public.exhibition_artworks;
drop policy if exists "exhibition_artworks_insert" on public.exhibition_artworks;
drop policy if exists "exhibition_artworks_select" on public.exhibition_artworks;
drop policy if exists "exhibitions_delete" on public.exhibitions;
drop policy if exists "exhibitions_update" on public.exhibitions;
drop policy if exists "exhibitions_insert" on public.exhibitions;
drop policy if exists "exhibitions_select" on public.exhibitions;
drop trigger if exists on_exhibitions_updated on public.exhibitions;
drop table if exists public.exhibition_artworks cascade;
drop table if exists public.exhibitions cascade;

-- ========== Attendance ==========
drop policy if exists "Users can insert own attendance" on public.attendance;
drop policy if exists "Users can read own attendance" on public.attendance;
drop table if exists public.attendance cascade;

-- ========== Moui Posts ==========
drop policy if exists "Users can update own moui_posts" on public.moui_posts;
drop policy if exists "Authenticated users can insert moui_posts" on public.moui_posts;
drop policy if exists "Anyone can read moui_posts" on public.moui_posts;
drop table if exists public.moui_posts cascade;

-- ========== Point History ==========
drop policy if exists "Users can insert own point history" on public.point_history;
drop policy if exists "Users can view own point history" on public.point_history;
drop table if exists public.point_history cascade;

-- ========== Core ==========
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_artworks_updated on public.artworks;
drop trigger if exists on_profiles_updated on public.profiles;
drop function if exists public.handle_new_user();
drop function if exists public.handle_updated_at();

drop policy if exists "follows_delete" on public.follows;
drop policy if exists "follows_insert" on public.follows;
drop policy if exists "follows_select" on public.follows;
drop policy if exists "artworks_delete" on public.artworks;
drop policy if exists "artworks_update" on public.artworks;
drop policy if exists "artworks_insert" on public.artworks;
drop policy if exists "artworks_select" on public.artworks;
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;

drop table if exists public.follows cascade;
drop table if exists public.artworks cascade;
drop table if exists public.profiles cascade;
