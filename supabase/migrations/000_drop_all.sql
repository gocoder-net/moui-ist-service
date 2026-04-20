-- ============================================================
-- MOUI-IST Drop All — 초기 개발용
-- Run this FIRST in Supabase Dashboard → SQL Editor
-- ============================================================

-- ========== 002_exhibitions ==========

-- Exhibition artwork policies
drop policy if exists "exhibition_artworks_delete" on public.exhibition_artworks;
drop policy if exists "exhibition_artworks_update" on public.exhibition_artworks;
drop policy if exists "exhibition_artworks_insert" on public.exhibition_artworks;
drop policy if exists "exhibition_artworks_select" on public.exhibition_artworks;

-- Exhibition policies
drop policy if exists "exhibitions_delete" on public.exhibitions;
drop policy if exists "exhibitions_update" on public.exhibitions;
drop policy if exists "exhibitions_insert" on public.exhibitions;
drop policy if exists "exhibitions_select" on public.exhibitions;

-- Exhibition triggers
drop trigger if exists on_exhibitions_updated on public.exhibitions;

-- Exhibition tables (순서: FK 의존)
drop table if exists public.exhibition_artworks cascade;
drop table if exists public.exhibitions cascade;

-- ========== 001_initial_schema ==========

-- Storage policies
drop policy if exists "artworks_storage_delete" on storage.objects;
drop policy if exists "artworks_storage_update" on storage.objects;
drop policy if exists "artworks_storage_insert" on storage.objects;
drop policy if exists "artworks_storage_select" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_select" on storage.objects;

-- Triggers
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_artworks_updated on public.artworks;
drop trigger if exists on_profiles_updated on public.profiles;

-- Functions
drop function if exists public.handle_new_user();
drop function if exists public.handle_updated_at();

-- Table policies
drop policy if exists "follows_delete" on public.follows;
drop policy if exists "follows_insert" on public.follows;
drop policy if exists "follows_select" on public.follows;
drop policy if exists "artworks_delete" on public.artworks;
drop policy if exists "artworks_update" on public.artworks;
drop policy if exists "artworks_insert" on public.artworks;
drop policy if exists "artworks_select" on public.artworks;
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;

-- Tables (순서: FK 의존)
drop table if exists public.follows cascade;
drop table if exists public.artworks cascade;
drop table if exists public.profiles cascade;
