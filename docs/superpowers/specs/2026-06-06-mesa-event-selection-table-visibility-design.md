# Mesa Event Selection Table Visibility Design

**Goal:** Prevent mesas from disappearing in `/compra` when the buyer selects an event in mesa mode.

**Problem:** `apps/landing/app/compra/page.tsx` currently reloads `/api/tables` with `event_id` when `selectedEventId` changes. `apps/landing/app/api/tables/route.ts` then filters the organizer table list down to event-scoped availability, which removes mesas that should still be visible to the buyer.

**Decision:** Keep the mesa list organizer-scoped. Selecting an event must not shrink the list of mesas shown in `/compra`.

**Behavioral Rules:**
- `/compra` must keep showing all mesas for the active organizer after event selection.
- Event selection may still affect overlay state such as reservation status and event-specific commercial fields.
- A mesa can be marked unavailable or reserved for the selected event, but it must remain visible in the list/map.
- The final reservation API remains the source of truth for rejecting invalid mesa-event combinations.

**Implementation Shape:**
- `apps/landing/app/compra/page.tsx` stops sending `event_id` when fetching `/api/tables`; it fetches organizer mesas only.
- `apps/landing/app/api/tables/route.ts` keeps supporting `event_id`, but when present it must overlay event-specific fields onto the organizer mesa list instead of filtering mesas out.
- `apps/landing/app/api/tables/route.test.ts` gets regression coverage proving mesas do not disappear when an event has no `table_availability` row for them.

**Risks / Non-Goals:**
- This change does not redesign the mesa/event domain model.
- This change does not auto-hide sold-out or inactive events; event sale blocking stays where it is today.
