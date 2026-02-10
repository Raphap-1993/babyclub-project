-- Add layout_size column to tables for persisting table size in croquis designer
-- Migration: 2026-02-08-add-layout-size-to-tables.sql

ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS layout_size INTEGER DEFAULT 60;

COMMENT ON COLUMN public.tables.layout_size IS 'Tamaño del cuadrado de la mesa en el croquis (en pixels, rango: 40-100)';
