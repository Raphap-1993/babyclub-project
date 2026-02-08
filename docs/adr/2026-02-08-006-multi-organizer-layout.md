# ADR 2026-02-08-006: Multi-Organizador Layout Isolation

**Date**: 2026-02-08  
**Status**: Accepted  
**Context**: Multiple event organizers (Colorimetría, BabyClub) need separate mesas layouts for same local physical space  

## Problem

Each organizer has:
- Different physical local (Colorimetría = Salon A, BabyClub = Salon B)  
- Different croquis/floor plan
- Different mesa positions (pos_x, pos_y relative to their layout)

Without isolation:
- Colorimetría's mesas visible in BabyClub's events ❌
- Coordinates misaligned between organizers ❌
- Copy-paste layout fragile (different canvases) ❌

## Decision

Implement **organizer-scoped layout management**:

1. Add `organizer_id` foreign key to `tables` table
2. Create `layout_settings` table per organizer + event
3. ALL queries filter: `WHERE event_id = ? AND organizer_id = ?`
4. Implement copy-layout feature to reuse positions from previous events

## Architecture

```
organizers (1: BabyClub, Colorimetría)
  ├─ events (N: many events per organizer)
  │   ├─ organizer_id (FK)
  │   ├─ layout_settings (1:1 layout metadata)
  │   │   ├─ layout_url (croquis image)
  │   │   ├─ canvas_width, canvas_height
  │   │   └─ scale
  │   └─ tables (N: mesas for this event+organizer)
  │       ├─ organizer_id (FK - for isolation)
  │       ├─ event_id (FK)
  │       ├─ pos_x, pos_y (% relative to canvas)
```

## Implementation

### 1. Database Migration
- Add `organizer_id` to `tables`
- Backfill from events relationship
- Create `layout_settings` table
- Indexes: `(organizer_id, event_id)`

### 2. API Changes
- Filter all table queries by `organizer_id`
- New endpoint: `GET /api/events/previous-layouts` (list closed events)
- New endpoint: `POST /api/events/layouts/copy` (copy layout)

### 3. UI Changes
- Add "Copy Layout" button in LayoutEditor
- Dialog to select previous event
- Auto-populate mesas with same positions

### 4. Query Pattern
```ts
// BEFORE (unsafe)
SELECT * FROM tables WHERE event_id = ?

// AFTER (safe)
SELECT * FROM tables 
WHERE event_id = ? AND organizer_id = ?
```

## Guarantees

| Scenario | Result |
|----------|--------|
| Colorimetría lists tables | Only sees organizer_id = colorimetria_uuid |
| Copy layout from CAC → Año Nuevo | Mesas positions preserved, layout_url copied |
| Admin of BabyClub accesses | organizer_id = babyclub_uuid filtered |
| Query without organizer filter | Impossible - all endpoints have guard |

## Alternatives Considered

| Alternative | Pros | Cons |
|-------------|------|------|
| **Organizer scoping (chosen)** | Clean, scalable, standard multi-tenant | Requires migration + backfill |
| Separate schema per org | Explicit isolation | Complex, hard to manage |
| Virtual view per org | Transparent filtering | Performance overhead |
| Copy mesas manually | Simple | Fragile, error-prone |

## Security

- `organizer_id` verified in every query
- Soft delete respected (deleted_at)
- Staff role check on copy endpoint
- No admin can access other org's layouts

## Performance

Indexes on (organizer_id, event_id) ensure:
- Table queries: O(log N)  
- Copy operations: O(M) where M = table count
- Typical: <100ms for event with 20 mesas

## Rollout

1. Execute migration (backfill `organizer_id` from events)
2. Deploy API + UI
3. Manual test: admin A creates event, copies layout, admin B doesn't see it
4. Monitor copy endpoint logs

## Related

- ADR 2026-02-07-003: Event scoping strict
- ADR 2026-02-07-004: Multi-organizer close reports
- Docs: `docs/MULTI-ORGANIZER-LAYOUT-2026-02-08.md`
