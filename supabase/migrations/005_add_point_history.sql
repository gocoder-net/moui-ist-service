-- 포인트 내역 테이블
CREATE TABLE IF NOT EXISTS point_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL,          -- 양수: 적립, 음수: 차감
  balance integer NOT NULL,         -- 거래 후 잔액
  type text NOT NULL,               -- 'mission', 'purchase', 'reward', 'spend' 등
  description text NOT NULL,        -- 표시할 설명
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_point_history_user ON point_history(user_id, created_at DESC);

-- RLS
ALTER TABLE point_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own point history"
  ON point_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own point history"
  ON point_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);
