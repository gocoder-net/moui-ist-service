-- 프로필에 포인트(모의) 컬럼 추가
-- 1모의 = 100원
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;
