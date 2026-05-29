-- Rollback del hotfix puntual del dashboard QR.
-- El estado previo del remoto no tenia este RPC; al borrarlo la app vuelve
-- a usar el fallback legacy en packages/api-logic/qr-summary.ts.

drop function if exists public.get_qr_summary_all(timestamptz);
