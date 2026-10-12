# Ayush Portfolio — anime-streaming site + secure admin

Node.js · Express · MongoDB · vanilla JS.
The public site is a Crunchyroll-style "streaming" portfolio (orange on black, anime + code vibes).
**Everything on it comes from the admin dashboard** — edit there, and the site updates (open pages refresh within ~20 s).

> **Going live?** See `DEPLOY.md` in the repo root (free: MongoDB Atlas + Render).

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill it in (use a random `JWT_SECRET` of at least 32 characters; do not use the example value).
3. `npm run seed`      (creates the first admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
4. `npm run dev`       (or `npm start` with `NODE_ENV=production`)

| URL | What |
| --- | --- |
| `/` | Public portfolio |
| `/admin` | Hidden admin login |
| `/dashboard` | Admin dashboard (login required) |
| `/api/portfolio` | Public JSON the site reads (hidden sections are left out) |

## The public site
- First visit of a session: intro splash → **"Who's watching?"** profile picker (You / Recruiter / Developer / Anime Fan).
  The chosen profile re-orders the whole page, the "Continue Exploring" shelf and the main hero button. Switch any time from the top-right chip.
- Hero (name, headline, location, top skills, objective) · Origin Story (About) · Skill Tree (auto-grouped tabs) ·
  The Story So Far (Experience) · Featured Episodes (Projects) · Academy Arc (Education) · Top Moments (Achievements) ·
  Certified · To Be Continued (Contact).
- Turn sections on/off in **Dashboard → Sections**. Edit the line under your name in **Dashboard → Profile → Headline**.

## Your images
- `public/img/hero.png`  — transparent cut-out used in the hero, picker and nav.
- `public/img/poster.jpg` — original artwork used on the About poster.
Replace either file (keep the names) to change them. For a new cut-out, use any background remover and export a PNG with transparency, about 900 px wide. `public/img/logo.svg` is used by the browser tab and site/admin headers; replace it to change the monogram branding.

## Security features\n- Same-origin checks on browser API mutations, hardened response headers, and no-store caching for private routes.\n- Server waits for MongoDB before listening; startup fails clearly if the database is unavailable.\n- Keep `.env` private and never commit it; `.env.example` contains placeholders only.
- Session ends when the tab/browser closes; token expires after 1 hour.
- Change login email and password in **Dashboard → Settings**; this signs out every other device.
- **Two-factor login** (Google Authenticator / Authy) in Settings.
- Account locks for 15 minutes after 5 wrong attempts; per-IP login rate limit (`LOGIN_RATE_MAX`, default 10 / 15 min).
- "Sign Out Everywhere Else" button; "Previous login" time + IP shown in Settings.

## Locked out or think you were compromised?
1. Put a new `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (10+ chars) in `.env`.
2. Run `npm run reset-admin` (resets login, turns 2FA off, clears the lock, signs out all sessions).
3. Remove `ADMIN_PASSWORD` from `.env`.
4. For extra safety change `JWT_SECRET` and restart: that also logs everyone out.
"# portfolio" 
