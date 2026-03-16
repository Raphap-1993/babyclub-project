-- Migration: Add ticket payment support
-- Extends payments table to link to tickets (solo entrada flow)
-- Adds payment_status to tickets (pending → paid/failed)

-- 1. Add ticket_id to payments (nullable, solo entrada flow)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL;

-- 2. Index for payments.ticket_id lookups
CREATE INDEX IF NOT EXISTS payments_ticket_id_idx
  ON public.payments(ticket_id)
  WHERE ticket_id IS NOT NULL;

-- 3. Add payment_status to tickets
--    NULL = free ticket (no payment required)
--    pending = awaiting Culqi payment confirmation
--    paid = confirmed via webhook
--    failed = payment failed or expired
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS payment_status text
  CHECK (payment_status IN ('pending', 'paid', 'failed'));

-- Note: index tickets_payment_status_idx was already prepared in
-- 2026-02-13-dashboard-timeout-performance-indexes.sql and will
-- activate automatically now that the column exists.
