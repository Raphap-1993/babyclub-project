# Table map connection

```
/registro (URL)
  -> apps/landing/app/registro/page.tsx (client page, App Router)
    -> Defines TABLES (viewBox coords for 1080x1659 map) + percentToViewBox() to align Supabase pos_%.
    -> Builds tableSlots (status, capacity, tableId, tableName, x/y/w/h) by matching TABLES labels to Supabase tables.
    -> Passes slots + selectedTableId + onSelect to TableMap component.
    -> Handles forms, reservation modal, selectedProduct, layoutUrl fetch, cover/logo/aforo data.
  -> apps/landing/app/registro/TableMap.tsx (client component)
    -> Renders <svg viewBox="0 0 1080 1659" preserveAspectRatio="xMidYMid meet">.
    -> <image href="/maps/venue-plan.png" ...> + <g> per table (rect + labels, available/reserved/selected styles).
    -> Zoom/pan via react-zoom-pan-pinch (NEXT_PUBLIC_MAP_ENABLE_ZOOM !== "false"), debug logs on click with ?debugMap=1 or NEXT_PUBLIC_MAP_DEBUG=true.
  -> Assets: apps/landing/public/maps/venue-plan.png (1080x1659), same URL used as fallback if /api/layout is empty.
  -> Data sources:
       • GET /api/tables -> Supabase `tables` + `table_products` + `table_reservations` (sets `is_reserved`, optional pos_x/pos_y/pos_w/pos_h in %).
       • GET /api/layout -> Supabase `layout_settings.layout_url` (current: https://wtwnhqbbcocpnqqsybln.supabase.co/storage/v1/object/public/event-assets/layouts/1765425634059-mesas.png) with NEXT_PUBLIC_TABLE_LAYOUT_URL or /maps/venue-plan.png fallback.
       • Branding/cover/aforo/codes: /api/branding, /api/manifiesto, /api/aforo, /api/codes/info.
  -> Selection flow:
       • tables fetched on mount; default selectedTable = first non-reserved table.
       • TableMap onSelect propagates table.id; page syncs selectedProduct for that table and shows details/list fallback for tables not drawn.
```
