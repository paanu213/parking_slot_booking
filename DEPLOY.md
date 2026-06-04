# Deployment Guide — Hostinger Cloud + GitHub Actions

Automatic deploys happen on every push to `main`:
| What | Where | How |
|------|-------|-----|
| Customer Site (staging) | Hostinger subdomain (test.autosahay.com) | Build in CI → rsync |
| Admin Panel | Hostinger subdomain (admin.autosahay.com) | Build in CI → rsync |
| Vendor Panel | Hostinger subdomain (vendor.autosahay.com) | Build in CI → rsync |
| Backend API | Hostinger server (Node.js + PM2) | SSH → git pull → build → restart |

> The apex domain `autosahay.com` already hosts a separate site, so the
> customer SPA currently deploys to **`test.autosahay.com`** (staging). When
> ready, point the apex (or `www.autosahay.com`) at this build by changing
> `CUSTOMER_DEPLOY_PATH` to the new subdomain's `public_html` — no workflow
> change required.

---

## STEP 1 — Hostinger: Create domains / subdomains

In **hPanel → Domains**, ensure each subdomain points at its own `public_html`:

| Domain | Suggested document root |
|--------|------------------------|
| `test.autosahay.com` (customer site — staging) | `/home/u.../domains/test.autosahay.com/public_html` |
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
| `CUSTOMER_DEPLOY_PATH` | `/home/u577205845/domains/test.autosahay.com/public_html` |
| `ADMIN_DEPLOY_PATH` | `/home/u577205845/domains/admin.autosahay.com/public_html` |
| `VENDOR_DEPLOY_PATH` | `/home/u577205845/domains/vendor.autosahay.com/public_html` |
| `BACKEND_DEPLOY_PATH` | `/home/u577205845/parking-api` |

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
       ├─► [CI Job 1] Build admin panel    → rsync to admin.autosahay.com
       ├─► [CI Job 2] Build vendor panel   → rsync to vendor.autosahay.com
       ├─► [CI Job 3] Build customer site  → rsync to test.autosahay.com
       └─► [Hostinger Node.js manager]     → git pull → npm build → prisma migrate deploy → restart
```

All three CI jobs run in **parallel**, total deploy time ~2–3 minutes.
Backend redeploys are handled by Hostinger's Node.js manager (linked to the
same repo) and finish in the same window.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| rsync permission denied | Check `HOSTINGER_SSH_KEY` secret has the exact right private key |
| SSH port refused | Confirm port is `65002`, not `22` |
| PM2 not found | Run `npm install -g pm2` on server, or use `npx pm2` (already in the script) |
| 404 on page refresh | `.htaccess` must be in `public_html` — Vite copies `public/.htaccess` automatically |
| CORS errors | Make sure `CORS_ORIGINS` in `.env` on server includes all frontend URLs |
| Prisma binary error | Re-run `npx prisma generate` on the server — it must be built for Linux |
| Cookie not sent | `COOKIE_DOMAIN` must be `.autosahay.com` (with leading dot) and `COOKIE_SECURE=true` |
