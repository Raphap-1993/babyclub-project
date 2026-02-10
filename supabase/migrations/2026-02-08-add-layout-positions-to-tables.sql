-- Migration: Add layout position columns to tables
-- Description: Adds layout_x and layout_y columns to store table positions in the croquis designer
-- Date: 2026-02-08

-- Add layout position columns to tables
ALTER TABLE tables 
ADD COLUMN IF NOT EXISTS layout_x DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS layout_y DECIMAL(10,2);

-- Add index for better query performance when loading layouts
CREATE INDEX IF NOT EXISTS idx_tables_layout_position 
ON tables(organizer_id, layout_x, layout_y) 
WHERE deleted_at IS NULL AND layout_x IS NOT NULL AND layout_y IS NOT NULL;

-- Add comment
COMMENT ON COLUMN tables.layout_x IS 'X coordinate position in the layout designer (in pixels)';
COMMENT ON COLUMN tables.layout_y IS 'Y coordinate position in the layout designer (in pixels)';
