-- 모의(협업) 게시판
CREATE TABLE IF NOT EXISTS moui_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  fields text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE moui_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read moui_posts"
  ON moui_posts FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert moui_posts"
  ON moui_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own moui_posts"
  ON moui_posts FOR UPDATE USING (auth.uid() = user_id);
