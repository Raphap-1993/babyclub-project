# Mesa Event Selection Table Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep organizer mesas visible in `/compra` after selecting an event.

**Architecture:** Preserve the organizer-scoped mesa list and apply event-specific state as a non-destructive overlay. The regression is fixed by changing the API behavior and aligning the public caller with that contract.

**Tech Stack:** Next.js App Router, Vitest, React client state.

---

### Task 1: Preserve Organizer Mesas During Event Selection

**Files:**
- Modify: `apps/landing/app/api/tables/route.ts`
- Modify: `apps/landing/app/api/tables/route.test.ts`
- Modify: `apps/landing/app/compra/page.tsx`

- [ ] **Step 1: Write the failing regression test**

Add a route test proving that when an organizer has two mesas and `table_availability` only includes one for the selected event, the endpoint still returns both mesas instead of filtering one out.

- [ ] **Step 2: Run the route test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/landing/app/api/tables/route.test.ts
```

- [ ] **Step 3: Implement the minimal fix**

- In `apps/landing/app/api/tables/route.ts`, stop removing mesas when `table_availability` rows exist; overlay reservation/commercial state onto the full organizer list instead.
- In `apps/landing/app/compra/page.tsx`, stop appending `event_id` to the mesa list fetch so event selection does not trigger destructive refiltering.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm exec vitest run apps/landing/app/api/tables/route.test.ts
pnpm typecheck:landing
```

- [ ] **Step 5: Commit**

```bash
git add \
  apps/landing/app/api/tables/route.ts \
  apps/landing/app/api/tables/route.test.ts \
  apps/landing/app/compra/page.tsx
git commit -m "fix: keep mesas visible across event selection"
```
