-- Migration: add Pipefy-specific columns to projects
-- Run this in Supabase SQL editor or via psql against the project's DB

ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS pipefy_status TEXT;

ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS pipefy_owner_email TEXT;

ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS pipefy_priority TEXT;

ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC;

ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'projects_external_id_idx'
  ) THEN
    CREATE UNIQUE INDEX projects_external_id_idx ON projects (external_id);
  END IF;
END$$;
