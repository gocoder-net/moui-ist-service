-- 출석 체크
CREATE TABLE IF NOT EXISTS attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_date date NOT NULL DEFAULT CURRENT_DATE,
  day_number int NOT NULL,
  reward int NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, checked_date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own attendance"
  ON attendance FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attendance"
  ON attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
