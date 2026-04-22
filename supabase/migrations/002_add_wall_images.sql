-- 벽면 이미지 배경 지원을 위한 wall_images 컬럼 추가
-- 형식: { "north": { "url": "https://...", "mode": "stretch" }, "south": null, ... }
ALTER TABLE public.exhibitions
  ADD COLUMN IF NOT EXISTS wall_images jsonb NOT NULL DEFAULT '{}';
