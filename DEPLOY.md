# Deployment Guide — Hostinger Cloud + Vercel + GitHub Actions

## Architecture & deploy model (READ FIRST)

To keep Hostinger's process load low, **Hostinger runs only the production
customer site + the backend API.** Everything else (admin, vendor, and all
three stage apps) is hosted on **Vercel**.

### Who hosts what

| App | Stage (test) | Production (live) |
|-----|--------------|-------------------|
| **Customer** | Vercel (`stage` branch) | **Hostinger** (`main` branch, GitHub Actions rsync) |
| **Admin**    | Vercel (`stage` branch) | **Vercel** (`main` branch) |
| **Vendor**   | Vercel (`stage` branch) | **Vercel** (`main` branch) |
| **Backend API** | — (shared `api.autosahay.com`) | **Hostinger** (Node.js manager, `main`) |

> There is one shared backend (`api.autosahay.com`) for every frontend, prod
> and stage. Stage frontends point at the same prod API — keep that in mind when
> testing anything that writes data.

### Branching: `stage` → `main`

**Code flows stage → main, never the other way.**

```
                 push                          push
   ┌─────────┐  ──────►  Vercel (all STAGE)   ┌────────┐  ──────►  Vercel  (prod admin + vendor)
   │  stage  │           stage admin/vendor/  │  main  │           Hostinger (prod customer + API)
   │ (work)  │           customer  ← test     │ (prod) │
   └────┬────┘                                └────────┘
        │   merge ONLY when the human explicitly says "merge to main"
        └───────────────────────────────────────►
```

**Rules:**
1. All day-to-day code changes are committed and pushed to **`stage`**.
2. Pushing `stage` triggers **Vercel** deploys of the stage admin/vendor/customer
   apps for testing.
3. **Nothing reaches production until a human explicitly says "merge to main."**
   No automatic or implied promotion — the instruction must be clear and explicit.
4. Pushing `main` deploys production: Vercel rebuilds prod admin + vendor, the
   GitHub Actions workflow rsyncs the customer SPA to Hostinger, and Hostinger's
   Node.js manager rebuilds the backend.

| Branch | Deploys to |
|--------|-----------|
| `stage` | Vercel: stage admin + stage vendor + stage customer |
| `main` | Vercel: prod admin + prod vendor · Hostinger: prod customer + backend API |

---

## Hostinger — production customer site + backend (`main` branch)

On every push to `main`:
| What | Where | How |
|------|-------|-----|
| Customer Site | Hostinger (customer domain) | GitHub Actions build → rsync |
| Backend API | Hostinger server (Node.js manager) | git pull → build → `prisma migrate deploy` → restart |

> Admin and vendor panels are **no longer deployed to Hostinger** — they run on
> Vercel. The GitHub Actions workflow only deploys the customer SPA.

---

## STEP 1 — Hostinger: Create domains / subdomains

In **hPanel → Domains**, ensure each subdomain points at its own `public_html`:

| Domain | Suggested document root |
|--------|------------------------|
| `test.autosahay.com` (customer site — stage) | `/home/u.../domains/test.autosahay.com/public_html` |
| `admin.autosahay.com` | `/home/u.../domains/admin.autosahay.com/public_html` |
| `vendor.autosahay.com` | `/home/u.../domains/vendor.autosahay.com/public_html` |
| `api.autosahay.com` | (not a web folder — backend runs on a port) |

---

## STEP 2 — Hostinger: Generate SSH key pair

SSH into your Hostinger server (SSH port is **65002**):

```bash
# From your local machine
ssh -p 65002 u577205845@srv1749.hstgr.io
```

Once on the server, generate a key pair:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy
# Press Enter twice (no passphrase)
```

Add the **public key** to GitHub (so the server can clone/pull):

```bash
cat ~/.ssh/github_deploy.pub
# Copy this output → paste into GitHub repo → Settings → Deploy Keys → Add Deploy Key
# Title: "Hostinger Server"  |  Allow write access: NO
```

Configure SSH on the server to use this key for GitHub:

```bash
cat >> ~/.ssh/config << 'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  StrictHostKeyChecking no
EOF
chmod 600 ~/.ssh/config
```

Test the connection:

```bash
ssh -T git@github.com
# Should say: Hi username! You've successfully authenticated...
```

---

## STEP 3 — Hostinger: Clone the repository

```bash
cd ~
git clone git@github.com:paanu213/parking_slot_booking.git parking-api
cd parking-api
```

---

## STEP 4 — Hostinger: Create the production .env

```bash
cp parking_space_backend/.env.example parking_space_backend/.env
nano parking_space_backend/.env
```

Fill in the real values. Key fields for Hostinger:

```env
NODE_ENV=production
PORT=4000
API_BASE_URL=https://api.autosahay.com

# Your Hostinger MySQL database
DATABASE_URL=mysql://u577205845_dbuser:password@srv1749.hstgr.io:3306/u577205845_dbname

# Your domain (for cookies to work across subdomains)
COOKIE_DOMAIN=autosahay.com
COOKIE_SECURE=true

# All three frontends allowed
CORS_ORIGINS=https://admin.autosahay.com,https://vendor.autosahay.com,https://autosahay.com

# ... fill in R2, JWT secrets, Razorpay, etc.
```

---

## STEP 5 — Hostinger: First-time build and start

```bash
cd ~/parking-api

# Install all workspace deps
npm install

# Build backend TypeScript
npm run build --workspace=parking_space_backend

# Generate Prisma client and run migrations
cd parking_space_backend
npx prisma generate
npx prisma migrate deploy
cd ..

# Start with PM2
npx pm2 start ecosystem.config.cjs
npx pm2 save
npx pm2 startup   # Follow the printed command to auto-start on reboot
```

Check it's running:

```bash
npx pm2 list
npx pm2 logs parking-api --lines 50
```

---

## STEP 6 — Hostinger: Set up reverse proxy for the API

In **hPanel → Node.js** or use `.htaccess` + proxy rules to forward `api.autosahay.com` → `localhost:4000`.

Or use Hostinger's built-in **Node.js App** feature (hPanel → Node.js):
- Application URL: `api.autosahay.com`
- Application root: `/home/u.../parking-api/parking_space_backend`
- Application startup file: `dist/server.js`
- Node.js version: 20.x

> If using hPanel Node.js manager instead of PM2, remove the PM2 steps above and let hPanel manage the process.

---

## STEP 7 — GitHub: Add Secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|-------------|-------|
| `HOSTINGER_HOST` | `srv1749.hstgr.io` _(or your server IP)_ |
| `HOSTINGER_USER` | `u577205845` _(your SSH username)_ |
| `HOSTINGER_SSH_KEY` | Contents of your **local** `~/.ssh/id_rsa` or `id_ed25519` _(the private key you use to SSH into Hostinger)_ |
| `HOSTINGER_SSH_PORT` | `65002` |
| `VITE_API_URL` | `https://api.autosahay.com/api` |
| `CUSTOMER_DEPLOY_PATH` | `/home/u577205845/domains/<customer-domain>/public_html` |

> Admin/vendor `*_DEPLOY_PATH` secrets are no longer used — those panels are on
> Vercel now. Only `CUSTOMER_DEPLOY_PATH` is needed for the Hostinger workflow.

> **HOSTINGER_SSH_KEY** is your **local machine's private key** (the one that can SSH into Hostinger — copy the entire contents including `-----BEGIN...-----` and `-----END...-----` lines).  
> To get it: `cat ~/.ssh/id_ed25519` (or `id_rsa`)

---

## STEP 8 — Push to GitHub and trigger first deploy

```bash
# From your local project root
cd "E:\Web and App works\Develop\parking_slot_booking"

git init
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git add .
git commit -m "Initial commit — full monorepo"
git push -u origin main
```

This push will trigger the GitHub Actions workflow. Go to **Actions** tab in GitHub to watch the deploy.

---

## How deploys work after setup

```
You push to main
       │
       ├─► [GitHub Actions] Build customer site → rsync to Hostinger
       ├─► [Hostinger Node.js manager] git pull → build → prisma migrate deploy → restart API
       └─► [Vercel] admin + vendor projects build PRODUCTION (→ admin/vendor.autosahay.com)

You push to stage
       │
       └─► [Vercel] admin + vendor + customer projects build the STAGE branch
              (→ stageadmin / stagevendor / stagecustomer.autosahay.com branch domains)
```

---

## Vercel — admin + vendor + stage customer (3 projects, branch-based)

Use **one Vercel project per app** (3 total), not one per environment. Each project
serves **production from `main`** and a **stable stage URL from the `stage` branch**
via a branch-assigned domain. This is fewer projects to manage and makes promotion
"just merge `stage` → `main`".

| Vercel project | Root Directory | `main` → Production | `stage` → Preview (branch domain) |
|----------------|----------------|---------------------|-----------------------------------|
| **admin**    | `parking_space_frontend_admin`  | `admin.autosahay.com`  | `stageadmin.autosahay.com`  |
| **vendor**   | `parking_space_frontend_vendor` | `vendor.autosahay.com` | `stagevendor.autosahay.com` |
| **customer** | `parking_space_frontend`        | *(none — prod is Hostinger)* | `stagecustomer.autosahay.com` |

> The **customer** project is **stage-only** on Vercel — production customer lives on
> Hostinger (`main`, via GitHub Actions). Set its **Production Branch = `stage`** so
> the project has something to build, and attach `stagecustomer.autosahay.com` as its
> production domain. Do **not** point a prod customer domain here.

For **every** project:

**Settings → Build & Development**
- **Root Directory:** the app folder per the table.
- Enable **"Include files outside the root directory"** — this is an npm-workspace
  monorepo and each SPA imports `@ps/types` / `@ps/ui`, so Vercel must install
  from the repo root for the shared packages to resolve.
- Framework preset: **Vite** (build `npm run build`, output `dist`).
- Each app already has a `vercel.json` with the SPA fallback rewrite, so deep
  links like `/login` work.

**Settings → Git → Production Branch** — `main` for admin & vendor; `stage` for customer.

**Settings → Domains** — assign the stage subdomain to the `stage` branch:
1. Add `admin.autosahay.com` → it auto-attaches to Production (`main`).
2. Add `stageadmin.autosahay.com` → click it → set **Git Branch = `stage`**. This
   pins a stable URL that always serves the latest `stage` commit (instead of a
   random per-commit `*.vercel.app` preview URL). Same pattern for vendor/customer.

**Settings → Environment Variables** — ⚠️ tick **BOTH `Production` and `Preview`** scopes
for every variable. Vite bakes env vars at build time, and Vercel builds the `stage`
branch with **Preview**-scoped vars; if you only set Production, stage builds ship the
localhost fallback.
| Name | Value | Scopes |
|------|-------|--------|
| `VITE_API_URL` | `https://api.autosahay.com/api` | Production + Preview |
| `VITE_VENDOR_URL` *(customer project only)* | `https://vendor.autosahay.com` | Production + Preview |

> `VITE_ADMIN_URL` is **not used by any app** — don't add it (delete it if present).
> Env-var changes only take effect on the **next deploy** — redeploy after editing.

**Settings → Deployment Protection** — turn **Vercel Authentication OFF**. On Pro it's
on by default for Preview deployments, which would put a Vercel login wall in front of
your `stage*.autosahay.com` URLs.

### Domains must be `autosahay.com` subdomains (auth requirement)

Auth cookies are `Domain=.autosahay.com; SameSite=Lax`, so every frontend must be
served from an `autosahay.com` subdomain to be *same-site* with
`api.autosahay.com`. A bare `*.vercel.app` URL is cross-site → the browser won't
send the session cookie → login silently fails. Add each domain under
**Settings → Domains** and point its DNS (CNAME) at Vercel.

> **Cutover note:** `admin.autosahay.com` / `vendor.autosahay.com` currently resolve to
> Hostinger. Moving them to Vercel means repointing their DNS (CNAME) to Vercel — a
> domain can only target one host. The old Hostinger admin/vendor folders then go dead
> (harmless). Customer + backend DNS stay on Hostinger, untouched.

### Backend must allow every origin

After the domains exist, set the Hostinger backend `.env` to list **all** of them
(prod + stage), then restart the backend:

```
CORS_ORIGINS=https://admin.autosahay.com,https://vendor.autosahay.com,https://<customer-domain>,https://stageadmin.autosahay.com,https://stagevendor.autosahay.com,https://stagecustomer.autosahay.com
FRONTEND_CUSTOMER_URL=https://<customer-domain>
FRONTEND_ADMIN_URL=https://admin.autosahay.com
FRONTEND_VENDOR_URL=https://vendor.autosahay.com
```

Also add **every** origin above to the Google OAuth **Authorized JavaScript
origins** (the OAuth redirect validates the SPA's origin against `CORS_ORIGINS`).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| rsync permission denied | Check `HOSTINGER_SSH_KEY` secret has the exact right private key |
| SSH port refused | Confirm port is `65002`, not `22` |
| PM2 not found | Run `npm install -g pm2` on server, or use `npx pm2` (already in the script) |
| 404 on page refresh | `.htaccess` must be in `public_html` — Vite copies `public/.htaccess` automatically |
| CORS errors | Make sure `CORS_ORIGINS` in `.env` on server includes all frontend URLs (incl. the Vercel domain) |
| Prisma binary error | Re-run `npx prisma generate` on the server — it must be built for Linux |
| Cookie not sent / login won't stick | Customer site must be on an `autosahay.com` subdomain (same-site with the API). `COOKIE_DOMAIN` = `.autosahay.com`, `COOKIE_SECURE=true` |
| OAuth redirects to localhost | Backend uses the SPA's origin if it's in `CORS_ORIGINS`; otherwise falls back to `FRONTEND_CUSTOMER_URL`. Add the Vercel domain to `CORS_ORIGINS`. |
