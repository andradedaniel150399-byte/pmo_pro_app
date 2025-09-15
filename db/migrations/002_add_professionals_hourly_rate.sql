-- Migration: add hourly_rate to professionals
-- Run this in Supabase SQL editor or via psql against the project's DB

ALTER TABLE IF EXISTS professionals
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC;
