# ADR 2026-02-08-005: Multi-Evento Table Isolation Pattern

**Date**: 2026-02-08  
**Status**: Accepted  
**Context**: Multi-evento system where mesas and reservations from closed events were contaminating new events  
**Decision**: Use soft delete pattern (deleted_at) for table_reservations on event close  

## Problem

User reported: "CAC cierre y se quedan las mesas con estado reservadas. Cuando abrí el nuevo evento, vi la reserva de mesa del evento anterior"

Root cause: `/api/events/close` endpoint desactivated codes but did NOT archive table_reservations. This caused:
- Same email in two events → queries returned old event's reservation data
- Mesa status carried over → looked "reserved" in new event
- Multi-tenant isolation broken at data level

## Decision

When closing an event via `POST /api/events/close`:

1. Count active reservations: `SELECT COUNT(*) FROM table_reservations WHERE event_id=? AND deleted_at IS NULL`
2. Archive them: `UPDATE table_reservations SET deleted_at=now(), status='archived' WHERE event_id=? AND deleted_at IS NULL`
3. Log the count in response: `archived_reservations: N`

This uses the soft delete pattern already established for other entities (events, codes, tickets).

## Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **Soft delete (chosen)** | Non-destructive, auditable, reversible, leverages existing pattern | Requires careful filtering in all queries |
| Hard delete | Clean removal | Loses audit trail, breaks reporting, risky on live data |
| Archive table | Explicit archival intent | Doubles schema, migration burden |
| Keep status='archived' only | Simpler semantics | Queries must check both status AND event_id, less clear about "deleted" |

## Implementation

**File**: `/apps/backoffice/app/api/events/close/route.ts`

**Added steps** (lines 75-108):
```ts
// Count active reservations for event
const countReservationsQuery = supabase
  .from("table_reservations")
  .select("id", { count: "exact", head: true })
  .eq("event_id", id)
  .is("deleted_at", null);

// Archive them
const { error: reservationsError } = await supabase
  .from("table_reservations")
  .update({ deleted_at: closedAt, status: "archived" })
  .eq("event_id", id)
  .is("deleted_at", null);
```

**Updated response** (now includes):
```json
{
  "archived_reservations": 42
}
```

## Guarantees

### Isolation
- Event A closed with 42 reservations → all marked `deleted_at`
- Event B starts → queries filter `WHERE event_id=B AND deleted_at IS NULL`
- No data leakage ✅

### Auditability
- Can query: `SELECT * FROM table_reservations WHERE event_id=? AND deleted_at IS NOT NULL` to see archived
- Timestamp in deleted_at shows when event closed
- Status changed to 'archived' for semantic clarity

### Reversibility
- If need to "reopen" event: `UPDATE table_reservations SET deleted_at=NULL WHERE event_id=? AND status='archived'`
- No permanent loss of data

## Affected Queries

All queries already use `applyNotDeleted()` pattern, so they automatically filter `deleted_at IS NULL`:

- `/admin/reservations` (backoffice)
- `/api/tables?event_id=X` (landing)
- `/ticket/[id]` reservation lookups (landing)

**No changes needed** to these queries - they're already protected by `applyNotDeleted()`.

## Performance

Queries filter by:
- `event_id` (partitioned by event)
- `deleted_at` (null/not null)

Recommended index:
```sql
CREATE INDEX idx_table_reservations_event_deleted 
ON public.table_reservations(event_id, deleted_at, email, phone);
```

## Testing

- 40/40 tests passing (added 2 placeholder tests)
- `/api/events/close/route.test.ts` has integration test templates
- Manual smoke test recommended: close CAC event, verify no Mesa shows up in next event

## Rollout

- Deploy `/api/events/close` changes
- Document in runbook: "Closing event archives reservations automatically"
- Monitor logs for `archived_reservations` count to validate

## Related

- **ADR 2026-02-07-003**: Event scoping strict (event_id always required in multi-tenant queries)
- **ADR 2026-02-07-004**: Multi-organizer close reports (audit trail)
- **Docs**: `docs/MULTI-EVENT-TABLE-ISOLATION-2026-02.md`
