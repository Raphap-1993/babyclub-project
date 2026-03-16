-- Migration: Remove circular FK table_reservations.ticket_id
--
-- Context:
--   tickets.table_reservation_id → table_reservations.id  (child→parent, source of truth)
--   table_reservations.ticket_id → tickets.id             (parent→child, REDUNDANT — creates circular dependency)
--
-- Fix: Drop the redundant column. All lookups now go through tickets.table_reservation_id,
--      which already has indices and is the canonical direction.
--
-- Affected code updated before this migration:
--   apps/backoffice/app/api/reservations/resend/route.ts — replaced direct read with reverse lookup

ALTER TABLE public.table_reservations
  DROP COLUMN IF EXISTS ticket_id;
