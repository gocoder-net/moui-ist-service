-- 작품에 세부 분야(category)와 메타데이터(metadata) 컬럼 추가
ALTER TABLE public.artworks ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.artworks ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
