-- Add BGM URL column to exhibitions
ALTER TABLE public.exhibitions
  ADD COLUMN IF NOT EXISTS bgm_url text;

-- Create BGM storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('bgm', 'bgm', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for bgm bucket
CREATE POLICY "bgm_select" ON storage.objects FOR SELECT USING (bucket_id = 'bgm');
CREATE POLICY "bgm_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'bgm' AND auth.role() = 'authenticated');
CREATE POLICY "bgm_update" ON storage.objects FOR UPDATE USING (bucket_id = 'bgm' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bgm_delete" ON storage.objects FOR DELETE USING (bucket_id = 'bgm' AND auth.uid()::text = (storage.foldername(name))[1]);
