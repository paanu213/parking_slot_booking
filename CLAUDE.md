# Project Guidelines for Claude

These rules have been learned from real bugs in this codebase.
Claude **must** read and apply them before writing any UI code.

---

## 1. Dropdowns / Popovers must never be inside `overflow-hidden` containers

**Rule:** Any element that uses `position: absolute` or `position: fixed` to escape its parent
(dropdowns, tooltips, date-pickers, context menus, comboboxes, colour-pickers) will be
**silently clipped** if any ancestor has `overflow: hidden`.

**Do this:**
```tsx
// Card that contains a dropdown → no overflow-hidden
<div className="card">          {/* ✅ no overflow-hidden */}
  <DropdownMenu />              {/* absolute-positioned, free to escape */}
</div>
```

**Don't do this:**
```tsx
<div className="card overflow-hidden">   {/* ❌ clips the dropdown */}
  <DropdownMenu />
</div>
```

**When you DO need `overflow-hidden`** (e.g. to clip a `<table>` at rounded corners):
- Keep `overflow-hidden` on an *inner* wrapper that wraps only the table, not the whole card.
- Or render the dropdown via a React portal so it mounts outside the clipped subtree.

**Affected pattern in this project:** `.card` already has `border-radius`; adding
`overflow-hidden` to clip table corners is only needed on the table's own wrapper div, not the
top-level card. Example of the correct split:

```tsx
<div className="card">                       {/* no overflow-hidden → dropdowns work */}
  <div className="card-header">
    <FilterDropdown />                       {/* absolute dropdown — safe */}
  </div>
  <div className="overflow-hidden rounded-b-xl">   {/* overflow-hidden only here */}
    <table>…</table>
  </div>
</div>
```

---

## 2. Pill / tab filter bars

- Use the pattern already established in `BookingsPage`, `PaymentsPage`, and the dashboard
  Period Analysis card (quick tabs + "More ▾" dropdown).
- The "More" dropdown must open with `position: absolute` relative to its trigger button,
  **not** relative to the card. Ensure no `overflow-hidden` ancestor exists above the trigger.

---

## 3. Custom date range inputs

- Always lay out From/To date inputs **in a row** (`flex items-center gap-2`), never stacked.
- Give each input an explicit width (`w-36 sm:w-40`), not `w-full`, so they never stack on desktop.
- Separate them with a `→` arrow; add a "From" label before the first input for clarity.
- **Position:** render the date inputs as a second row **inside the same right-aligned controls
  column** as the filter tabs/More button — never as a sibling row of the whole header.
  This keeps the inputs visually grouped with the filter that revealed them:

  ```
  [Period Analysis  FY 2025-26]    [Today] [Week] [Month] [Year] [More ▾]
                                   From [____] → [____]  ✓ Applied
  ```

  The controls column uses `flex flex-col items-end gap-2` so both rows stack right-aligned.

---

## 4. Slide-over / drawer panels

- Use `ml-auto flex h-full flex-col` on the panel itself — no `tailwindcss-animate` required.
- Backdrop: `fixed inset-0 bg-black/40 z-40`, panel: `fixed inset-y-0 right-0 z-50 w-[420px]`.
- Never wrap a slide-over in an `overflow-hidden` ancestor.

---

## 5. Monorepo workspace layout

| App | Port | Package name |
|-----|------|--------------|
| Customer frontend | 5173 | `@ps/web-customer` |
| Vendor frontend   | 5174 | `@ps/web-vendor` |
| Admin frontend    | 5175 | `@ps/web-admin` |
| Backend (Express) | 3000 | `parking_space_backend` |

Shared packages: `@ps/types` (Zod schemas), `@ps/ui` (shared components).

### Prisma schema changes — use **migrations**, never `db push`

This project tracks the DB with versioned migrations in `parking_space_backend/prisma/migrations`.
**Do not run `prisma db push`** — it mutates the schema without recording history, which
desyncs the migrations table and later makes `migrate deploy` fail with **P3018
("table already exists")**. That exact drift happened on 2026-06-07.

After any **Prisma schema change**:
1. Stop the backend server (releases the query-engine DLL lock on Windows).
2. **Author a migration** under `prisma/migrations/<timestamp>_<name>/migration.sql`
   (UTF-8, **no BOM**). For additive columns this is plain `ALTER TABLE … ADD COLUMN …`
   matching Prisma's MySQL output: strings `VARCHAR(191) NULL`, enums `ENUM('A','B')`,
   datetimes `DATETIME(3)`. Keep changes **additive + nullable/defaulted** for zero-downtime.
3. Apply it: `npx prisma migrate deploy` (production-safe — only runs committed migrations,
   never resets). The local `DATABASE_URL` points at the **live Hostinger DB**, so this is
   real production — review the SQL first.
4. `npx prisma generate` (regenerates the client; needs the backend stopped on Windows).
5. Restart the backend.

**Two-track flow:** the migration file rides `stage` → tested → merged to `main`; `migrate deploy`
is the command that applies it in each environment.

**If you ever hit P3018** (a table/column already exists because of a past `db push`), baseline it —
mark the offending migration as already-applied *without* re-running its SQL:
`npx prisma migrate resolve --applied <migration_name>`, then re-run `migrate deploy`.

---

## 6. Walk-in / direct bookings

- `isDirectBooking: true` on the `Booking` model means a vendor-created offline booking.
- Guest fields: `guestName`, `guestPhone`, `guestVehicleNumber`, `guestVehicleModel`.
- In any customer column, show `guestName ?? 'Walk-in Guest'` when `isDirectBooking` is true,
  never leave it blank.

---

## 7. Vendor filter lists

- Never derive a filter dropdown's option list from the rows currently on screen.
  If a vendor has no rows in the current dataset, they disappear from the filter.
- Always load the full vendor list from `GET /admin/vendors` separately.

---

## 8. Financial Year (India)

- FY runs **1 April → 31 March**.
- "This FY" label format: `FY 2025–26` (en-dash, 2-digit end year).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
