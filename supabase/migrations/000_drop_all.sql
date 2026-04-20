-- ============================================================
-- MOUI-IST Drop All — 초기 개발용
-- Run this FIRST in Supabase Dashboard → SQL Editor
-- ============================================================

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

-- Tables (순서 중요: FK 의존성)
drop table if exists public.follows cascade;
drop table if exists public.artworks cascade;
drop table if exists public.profiles cascade;
