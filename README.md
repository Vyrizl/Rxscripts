# RXScripts — Vercel Edition

Roblox script repository. Vercel Serverless Functions + Neon Postgres + Brevo email + Cloudflare Turnstile.

## Stack

- **Frontend**: React 18 + Vite (builds to `dist/`)
- **Backend**: Vercel Serverless Functions (`api/` directory)
- **Database**: Neon Postgres (`@neondatabase/serverless`)
- **Email**: Brevo (300 emails/day free forever)
- **Captcha**: Cloudflare Turnstile (free forever)
- **Auth**: JWT + bcrypt, email verification required

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/YOUR/rxscripts.git
git push -u origin main
```

### 2. Import on Vercel

Go to https://vercel.com/new → Import Git Repository → select your repo.

**Build settings** (auto-detected from vercel.json):
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### 3. Get a Neon database

1. Sign up at https://console.neon.tech (free tier, no credit card)
2. Create a new project
3. Copy the **Connection string** (looks like `postgres://user:pass@host/dbname`)

### 4. Set environment variables on Vercel

Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `SETUP_KEY` | any secret string |
| `BREVO_API_KEY` | from app.brevo.com |
| `SITE_URL` | `https://your-app.vercel.app` |
| `FROM_EMAIL` | verified sender in Brevo |
| `TURNSTILE_SECRET_KEY` | from Cloudflare Turnstile |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile Site Key (public) |
| `OWNER_USERNAME` | your admin username |

> `VITE_TURNSTILE_SITE_KEY` must be set as an environment variable — Vite bakes it into the frontend bundle at build time.

### 5. Deploy & run setup

After setting env vars → Deployments → Redeploy.

Then visit `https://your-app.vercel.app/setup` and fill in your admin details.

---

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in DATABASE_URL etc.
npm run dev                         # http://localhost:5173
```

> For local API calls, Vite proxies `/api` → `http://localhost:3000`.
> To test API routes locally, use `vercel dev` (install Vercel CLI: `npm i -g vercel`).
>
> Quickest local setup: `vercel dev` handles both frontend and API together.

---

## API structure

```
api/
  _db.js              Database connection + migrations
  _helpers.js         Shared utilities (auth, email, spam detection)
  _router.js          CORS wrapper + body/segment helpers

  auth/[...path].js   register, login, verify, resend-verification, me
  scripts/[...path].js  CRUD, comments, ratings, favorites, download, view
  users/[...path].js  profile GET/PATCH, badges, stats
  admin/[...path].js  stats, users, scripts management
  blog/[...path].js   blog posts CRUD
  badges/[...path].js list, grant, revoke, create

  announcements.js    site-wide announcements
  notifications.js    user notifications
  tags.js             tag list
  stats.js            site stats
  executors.js        executor list
  setup.js            one-time setup (locks after use)
  debug.js            env + DB connection check
```

---

## Key features

- **View/download dedup**: only counted once per 24h per logged-in user — guests never counted
- **Upload cooldown**: 5 minutes between script uploads
- **Thumbnails**: auto-resolved from Roblox game ID, universal fallback, or custom URL (verified users only)
- **Email verification**: required before login, powered by Brevo
- **Captcha**: Cloudflare Turnstile on login + register
- **Keep me logged in**: 30d vs 24h JWT
- **Notifications**: @mentions in comments, new comments on your scripts, badges
- **Badges**: owner assigns to users
- **Verified users**: admin grants, shown with checkmark
- **Verified scripts**: admin grants, shown with badge on card
- **Announcements + Blog**: owner/admin only
- **Owner role**: set via `OWNER_USERNAME` env var
