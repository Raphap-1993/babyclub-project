# Public Checkout Stepper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the public BabyClub `/compra` page into a four-step checkout for tickets and table reservations.

**Architecture:** Keep the current APIs and submit handlers. Add small presentational stepper primitives plus local step state inside `apps/landing/app/compra/page.tsx`, then render one task-focused section at a time.

**Tech Stack:** Next.js app router, React client components, Vitest, React DOM server rendering tests.

---

### Task 1: Stepper Primitives

**Files:**

- Create: `apps/landing/app/compra/PurchaseStepper.tsx`
- Modify: `apps/landing/app/compra/page.layout.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add tests that render the stepper with four labels: `Entradas`, `Datos`, `Resumen`, `Pago`; verify the active step has `aria-current="step"` and completed steps show as done.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/landing/app/compra/page.layout.test.tsx`

Expected: fail because `PurchaseStepper` does not exist.

- [ ] **Step 3: Implement minimal component**

Create `PurchaseStepper` with accessible buttons/labels, compact mobile-safe layout, and no business state.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/landing/app/compra/page.layout.test.tsx`

Expected: pass.

### Task 2: Wizard State Helpers

**Files:**

- Modify: `apps/landing/app/compra/purchaseState.ts`
- Modify: `apps/landing/app/compra/purchaseState.test.ts`

- [ ] **Step 1: Write failing helper tests**

Add tests for step labels, bounded next/previous movement, and active-step normalization.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/landing/app/compra/purchaseState.test.ts`

Expected: fail because helpers are missing.

- [ ] **Step 3: Implement helpers**

Add `PURCHASE_STEPS`, `normalizePurchaseStep`, `getNextPurchaseStep`, and `getPreviousPurchaseStep`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/landing/app/compra/purchaseState.test.ts`

Expected: pass.

### Task 3: Integrate `/compra`

**Files:**

- Modify: `apps/landing/app/compra/page.tsx`

- [ ] **Step 1: Add local wizard state**

Add separate step state for ticket and mesa, reset to step 1 on mode change, and compute active step from mode.

- [ ] **Step 2: Split render by step**

Move visible ticket blocks into selection, buyer data, summary, and payment sections. Move mesa blocks into selection, buyer data, summary, and payment sections.

- [ ] **Step 3: Add step CTAs**

Use `Continuar`, `Volver`, and final submit buttons. Validate only the current step before advancing. Preserve existing final submit handlers.

- [ ] **Step 4: Keep completion modals**

Keep existing confirmation and Culqi modals. The modal review/pago content can be rendered inline in steps 3 and 4 instead of opening the long modal.

### Task 4: Verification

**Files:**

- Modify as needed only in `apps/landing/app/compra/*`

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm exec vitest run apps/landing/app/compra/page.layout.test.tsx apps/landing/app/compra/purchaseState.test.ts
```

- [ ] **Step 2: Typecheck landing**

Run: `pnpm exec tsc --noEmit -p apps/landing/tsconfig.json`

- [ ] **Step 3: Build landing**

Run: `pnpm --filter landing build`

- [ ] **Step 4: Browser smoke**

Run local landing and verify mobile `/compra` shows only one main checkout step at a time, with `Entradas`, `Datos`, `Resumen`, `Pago` indicator visible.
