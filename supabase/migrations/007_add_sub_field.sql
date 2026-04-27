-- 프로필에 세부 분야 컬럼 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sub_field text;
