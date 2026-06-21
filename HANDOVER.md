# Production Handover & Go-Live Runbook

Operator-facing checklist for taking this application live and running it day-to-day.
For one-time infrastructure setup (Hostinger, Vercel, GitHub Actions, DNS), see
[DEPLOY.md](./DEPLOY.md). This document assumes that setup is already done.

---

## 1. System map

| App | Package | Port (dev) | Prod host |
|-----|---------|-----------|-----------|
| Customer SPA | `@ps/web-customer` (`parking_space_frontend`) | 5173 | Hostinger (`main`) |
| Vendor SPA | `@ps/web-vendor` (`parking_space_frontend_vendor`) | 5174 | Vercel (`main`) |
| Admin SPA | `@ps/web-admin` (`parking_space_frontend_admin`) | 5175 | Vercel (`main`) |
| Backend API | `parking_space_backend` | 4000 | Hostinger (`main`) |

Shared packages: `@ps/types` (Zod schemas/DTOs), `@ps/ui` (Avatar, Dropzone,
AmenityIcon, Input, `cn`). One shared backend (`api.autosahay.com`) serves all
SPAs, prod and stage.

**Database:** MySQL on Hostinger. Runtime queries go through **Prisma Accelerate**
(`DATABASE_URL=prisma://…`); migrations use the direct connection
(`DIRECT_URL=mysql://…`). Never run `prisma db push` — use migrations only
(see CLAUDE.md §5).

---

## 2. Pre-go-live checklist

### Secrets & environment (backend `.env`)
- [ ] `NODE_ENV=production`
- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — each a fresh `openssl rand -hex 32`,
      **different from each other**, not the `.env.example` placeholders.
      *(The server now refuses to boot in production if these look like placeholders,
      are equal, if `COOKIE_SECURE` is false, or if `CORS_ORIGINS` is empty.)*
- [ ] `COOKIE_SECURE=true` and `COOKIE_DOMAIN=autosahay.com`
- [ ] `CORS_ORIGINS` lists every prod **and** stage SPA origin
- [ ] `FRONTEND_CUSTOMER_URL` / `FRONTEND_VENDOR_URL` / `FRONTEND_ADMIN_URL` set (no trailing slash)
- [ ] `DATABASE_URL` (Accelerate `prisma://`) and `DIRECT_URL` (`mysql://`) both set
- [ ] R2 storage: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
      `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- [ ] Razorpay live keys (`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`) if taking payments
- [ ] Google/Facebook OAuth creds if social login is enabled
- [ ] `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` set to a real strong password

### Frontend build vars (Vercel — set for BOTH Production + Preview scopes)
- [ ] `VITE_API_URL=https://api.autosahay.com/api`
- [ ] `VITE_VENDOR_URL=https://vendor.autosahay.com` (customer project only)

### External services
- [ ] Every SPA origin added to Google OAuth **Authorized JavaScript origins**
- [ ] Razorpay webhook/keys point at the live account
- [ ] DNS for each SPA subdomain points at the right host (see DEPLOY.md cutover note)

### Data
- [ ] Migrations applied: `npx prisma migrate deploy` (review SQL first — it hits live DB)
- [ ] Super admin bootstrapped (section 3)
- [ ] **No demo data in prod** — never run `prisma:seed-demo` against production
      (it now refuses unless `ALLOW_DEMO_SEED=true`). Demo accounts use the
      `@autosahay.local` email suffix — search for and remove any that leaked in.

---

## 3. Bootstrap the first super admin

The app has no public admin signup — the first super admin is seeded, then all
other admins/sub-admins are created from inside the admin panel.

```bash
cd parking_space_backend
# Ensure SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD are set in .env
npm run prisma:seed
```

The seed is idempotent — it skips creation if that email already exists. Log in at
`admin.autosahay.com`, then create the real admin team via **Admins → Add Admin**
and stop using the seeded account (or rotate its password immediately).

---

## 4. Post-deploy smoke test

Run after every production deploy. All should pass before declaring the release good.

1. **Health** — `curl https://api.autosahay.com/health` → `{ "ok": true, "env": "production" }`
2. **Customer (public, no login):** Explore page loads, `/spaces` lists spaces,
   a space detail page opens. These must work **signed out**.
3. **Customer (gated):** visiting `/bookings`, `/profile`, `/saved`, `/checkout/:id`
   while signed out redirects to `/login`; after login they load. A hard refresh on
   one of these while logged in must **stay** on the page (no bounce to login).
4. **Vendor portal:** log in, view profile, create a direct (walk-in) booking,
   confirm the slot's vehicle type + price show in the selector.
5. **Admin portal:** log in, open a vendor's detail page, approve/edit a space,
   record a commission as received, edit a walk-in guest's details.
6. **Payments:** complete a Razorpay checkout end-to-end (or confirm test mode).
7. **Image upload:** upload a parking-space image (exercises R2).

---

## 5. Security posture (what's already enforced)

- **Transport/headers:** `helmet`, `x-powered-by` disabled, `trust proxy` for correct client IPs.
- **CORS:** strict allowlist from `CORS_ORIGINS`; credentials enabled; unknown
  origins get no CORS headers (XHR can't read responses) but top-level OAuth
  redirects still reach handlers.
- **Auth:** JWT access (15m) + refresh (30d) in `httpOnly`, `Secure`, `SameSite=Lax`,
  domain-scoped cookies; refresh tokens are revoked on logout. Passwords hashed with **argon2**.
- **Authorization:** role gates (`requireRole`) on vendor/admin routes; a few admin
  routes are `SUPER_ADMIN`-only (create/delete/deactivate admins).
- **Abuse limits:** global rate limit (300 / 15 min) + stricter auth limit (10 / 10 min)
  on login/register. Body size capped at 1 MB; `hpp` against param pollution.
- **Config safety:** env is Zod-validated and **fails fast** on boot for missing/invalid
  or insecure production settings.

---

## 6. Routine operations

**Deploy:** push to `stage` for testing → on explicit approval, merge `stage` → `main`.
`main` deploys prod (Vercel admin/vendor + Hostinger customer/API). Never auto-promote.

**Backend on Hostinger:**
```bash
cd ~/parking-api/parking_space_backend
npx pm2 list                 # process status
npx pm2 logs parking-api     # tail logs
npx pm2 restart parking-api  # restart after env change
```

**Apply a schema change (additive + nullable/defaulted for zero downtime):**
1. Stop the backend (releases the Windows query-engine lock during local authoring).
2. Author the migration SQL under `prisma/migrations/<ts>_<name>/migration.sql` (UTF-8, no BOM).
3. `npx prisma migrate deploy` (production-safe — only applies committed migrations).
4. `npx prisma generate` → restart backend.

See CLAUDE.md §5 for the P3018 baseline recovery if drift ever occurs.

---

## 7. Rollback

- **Frontend (Vercel):** Deployments → pick the last good build → **Promote to Production**.
- **Backend (Hostinger):** `git checkout <last-good-sha>` in `~/parking-api`, rebuild
  (`npm run build --workspace=parking_space_backend`), `npx pm2 restart parking-api`.
- **Database:** migrations are **forward-only**. Keep changes additive so a code
  rollback never requires a destructive schema rollback. To undo a column, ship a
  follow-up migration — do not hand-drop columns on the live DB.
```
