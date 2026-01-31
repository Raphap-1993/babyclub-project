# Security Controls

## Rate limiting (in-memory)

This repo uses a lightweight, in-memory rate limiter per process (no Redis). It is safe for local/dev and low-cost deployments, but **does not share state across instances**. For multi-instance production, swap the storage with Redis/Upstash.

### Applied routes

Landing (public):
- `GET /api/persons` → `RATE_LIMIT_PERSONS_PER_MIN` (default: 20 req/min/IP)
- `GET /api/reniec` → `RATE_LIMIT_RENIEC_PER_MIN` (default: 20 req/min/IP)
- `POST /api/uploads/voucher` → `RATE_LIMIT_UPLOADS_VOUCHER_PER_MIN` (default: 10 req/min/IP)
- `POST /api/tickets/email` → `RATE_LIMIT_TICKETS_EMAIL_PER_MIN` (default: 10 req/min/IP)

Backoffice (door scan):
- `POST /api/scan`
- `POST /api/scan/confirm`

Scan routes use `RATE_LIMIT_SCAN_PER_MIN` (default: 120 req/min). If the staff session is valid, the limiter key is `ip + staff_id` to avoid blocking multiple staff behind the same Wi‑Fi.

### Headers

When the limit is exceeded, the API responds `429` with:
- `Retry-After` (seconds)
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (epoch ms)

Body:
```json
{ "error": "rate_limited", "retryAfterMs": 60000 }
```

### Env vars

Set these to tune limits per environment (all are per minute):
- `RATE_LIMIT_PERSONS_PER_MIN`
- `RATE_LIMIT_RENIEC_PER_MIN`
- `RATE_LIMIT_UPLOADS_VOUCHER_PER_MIN`
- `RATE_LIMIT_TICKETS_EMAIL_PER_MIN`
- `RATE_LIMIT_SCAN_PER_MIN`

## Soft delete policy

Critical tables use soft delete columns (`deleted_at`, `deleted_by`, `is_active`). API delete endpoints now archive rows instead of deleting.

Archived records:
- are excluded by default in list/lookup queries (`deleted_at IS NULL`)
- keep historical data for audits
- block staff access when staff is archived
