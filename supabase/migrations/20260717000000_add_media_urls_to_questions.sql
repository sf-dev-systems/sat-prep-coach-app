ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT NULL;

COMMENT ON COLUMN questions.media_urls IS
  'Array of public Supabase Storage URLs for charts/figures. Null for text-only questions.';
