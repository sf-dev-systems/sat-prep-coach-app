-- Add unique constraint on questions.external_id to support upsert in import pipeline
ALTER TABLE questions ADD CONSTRAINT questions_external_id_unique UNIQUE (external_id);
