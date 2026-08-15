# Deployment Guide — Vercel (private beta)

This app is deployed as **two separate Vercel projects** (matching the two
GitHub repos): the API (`loyer`, this repo) and the frontend (`loyer-frontend`).
Both are on Vercel's free Hobby tier, which is enough for sharing a link with
a handful of people for feedback — see the limits called out below before
opening this up more broadly.

## Why the backend needed code changes first

Vercel runs the API as **stateless serverless functions**, not a long-running
process. Three things that assumed a persistent server were adapted:

- **File uploads** (KYC docs, property titles, maintenance photos): used to
  write to local disk (`uploads/`), which doesn't persist between
  invocations on Vercel. Now uses [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
  when `BLOB_READ_WRITE_TOKEN` is set, falling back to local disk otherwise
  (so local dev is unaffected). See `src/middleware/upload.ts`.
- **Background schedulers** (payout sweep, rent reminders): used to be
  `setInterval` loops in `src/index.ts`. Those don't run on Vercel - a
  function only executes during a request. They're now also reachable as
  HTTP endpoints (`GET /api/v1/internal/cron/payouts` and `/reminders`),
  protected by a `CRON_SECRET` header, and triggered by **Vercel Cron**
  (configured in `vercel.json`). The `setInterval` version still runs for
  local dev / `npm start` (`src/index.ts` skips it when `process.env.VERCEL`
  is set).
- **Database connection**: switched from discrete host/port/user fields to a
  single `DATABASE_URL` connection string with SSL enabled outside
  development, since a hosted Postgres (Neon, Supabase, etc.) needs TLS and
  isn't reachable the old way.

Redis was in `docker-compose.yml` but never actually used by the app - it's
not part of the Vercel setup at all.

## 1. Provision Postgres (Neon)

1. In the Vercel dashboard, open (or create) the backend project → **Storage**
   tab → **Create Database** → **Neon** (Postgres). This auto-injects
   `DATABASE_URL` (and a few `POSTGRES_*` aliases) into the project's env vars.
2. Run migrations against that database from your machine once:
   ```bash
   DATABASE_URL="<connection string from the Vercel Storage tab>" npm run db:migrate
   ```
   Re-run this any time a new `migrations/*.sql` file is added and deployed.

## 2. Provision file storage (Vercel Blob)

1. Same **Storage** tab → **Create Database** → **Blob**. This injects
   `BLOB_READ_WRITE_TOKEN` automatically - no code change needed on your end.

## 3. Backend project env vars

Set these in the Vercel project's **Settings → Environment Variables**
(`DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` are already set by steps 1-2):

| Variable | Notes |
|---|---|
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Generate real random values, not the repo defaults |
| `KPAY_API_KEY`, `KPAY_SECRET_KEY`, `KPAY_BASE_URL` | From the K-Pay dashboard |
| `KPAY_WEBHOOK_SECRET` | From K-Pay's webhook settings, pointed at `https://<your-backend>.vercel.app/api/v1/payments/webhook` |
| `CORS_ORIGIN` | The frontend's Vercel URL (set after step 5) |
| `CRON_SECRET` | Any random string - also used by Vercel Cron automatically once set |
| `RENT_GRACE_PERIOD_DAYS`, `PAYOUT_COMMISSION_RATE`, `PAYOUT_RESERVE_HOLD_HOURS` | Same values as local, or tune as needed |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Optional - without these, emails are silently skipped (logged only), same as local dev |
| `NODE_ENV` | `production` |

## 4. Deploy the backend

```bash
npx vercel login        # once
npx vercel link         # links this folder to the Vercel project
npx vercel --prod
```

`vercel.json` in this repo already routes every request to `api/index.ts`
(the Express app) and schedules the two cron sweeps once daily each -
Hobby-tier cron jobs are limited to once per day, so payouts held for the
48h dispute window and reminder emails are swept once a day rather than
every few minutes. That's fine for a feedback beta; upgrade to Pro later if
tighter timing matters.

## 5. Deploy the frontend

In the `loyer-frontend` repo:

1. Set `VITE_API_URL` (Vercel project env var) to the backend's deployed URL
   plus `/api/v1`, e.g. `https://loyer-api.vercel.app/api/v1`.
2. `npx vercel login && npx vercel link && npx vercel --prod`. Vercel
   auto-detects the Vite build (`npm run build`, output `dist/`).
   `vercel.json` already has the SPA rewrite React Router needs.

Then go back to the backend project's `CORS_ORIGIN` and set it to this
frontend URL, and redeploy the backend so the browser isn't blocked by CORS.

## Known limits on this setup (fine for a private beta, revisit before a real launch)

- Cron sweeps run once a day (Hobby plan limit) - payouts and reminder
  emails can lag by up to ~24h.
- No monitoring/error tracking (Sentry, etc.) wired up.
- No automated CI (tests run locally via `npm test`, not on push).
- Neon/Blob free tiers have storage and compute caps - fine for a handful of
  testers, not for real traffic.
