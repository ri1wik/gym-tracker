# Backend setup (owner runbook)

The app runs in guest mode until these steps are done: everything stays on the device and the sync layer is idle. Nothing here needs a card. Budget: about 30 minutes, most of it in the Google Cloud console.

The project for this app is `cmnpikpltsviyxbsszso` (URL `https://cmnpikpltsviyxbsszso.supabase.co`). If you ever recreate it, pick the **Mumbai (ap-south-1)** region, keep the database password in a password manager, and make sure the owner email is one you read: the pause warning for free projects arrives there.

## 1. Run the migration

Either in the dashboard:

1. SQL Editor, New query.
2. Paste the whole of `supabase/migrations/0001_init.sql` and Run. It is idempotent (every statement uses `if not exists` or `drop ... if exists` first), so running it twice is safe.
3. Paste the whole of `supabase/migrations/0002_monotone_grants.sql` and Run (also idempotent). It makes `deleted_at` and `finished_at` one-way on the server, stops account deletion while photos remain, and tightens the grants on `keepalive` and the trigger functions. A project that already ran 0001 needs this one too.
4. Check Table Editor: 13 tables plus `keepalive`, every one with the RLS badge. Storage: a private bucket `photos`.

Or with the CLI from the repo root:

```bash
npx supabase login
npx supabase link --project-ref cmnpikpltsviyxbsszso
npx supabase db push
```

Before any later schema change take a dump first; the free plan has no automatic backups:

```bash
npx supabase db dump --linked -f backup.sql
```

## 2. Google sign-in

In the Google Cloud console (a project of your own, any name):

1. APIs and Services, OAuth consent screen: External, app name Recomp, your email as support and developer contact, scopes `openid`, `email`, `profile` only. Publish it (Publishing status: In production). Left in Testing, only 100 listed test users can sign in and the consent screen says "unverified".
2. Credentials, Create credentials, OAuth client ID, type Web application.
   - Authorised JavaScript origins: `https://ri1wik.github.io` and `http://localhost:5173`
   - Authorised redirect URIs: `https://cmnpikpltsviyxbsszso.supabase.co/auth/v1/callback`
3. Copy the client ID and the client secret.

In the Supabase dashboard:

1. Authentication, Providers, Google: enable, paste the client ID and client secret, save. Leave "Skip nonce check" off.
2. Authentication, Providers, Email: turn **off** "Enable email provider" while sign-in is Google only (nobody can create a password account by accident).

The client secret lives only in the dashboard. Never put it in the repo.

## 3. URL configuration

Authentication, URL Configuration:

- Site URL: `https://ri1wik.github.io/gym-tracker/`
- Redirect URLs (add each):
  - `https://ri1wik.github.io/gym-tracker/**`
  - `http://localhost:5173/**`
  - `http://127.0.0.1:5173/**`

The app sends `redirectTo` as its own base URL, so the Google round trip lands on `/gym-tracker/?code=...`, the client exchanges the code before the router mounts, and the query is stripped.

## 4. Keys into the build

Project Settings, Data API: copy the **Project URL**. Project Settings, API Keys: copy the **publishable** key (`sb_publishable_...`; the legacy `anon` JWT also works). Both are safe to publish: they only reach data through row level security.

Repository, Settings, Secrets and variables, Actions, add two repository secrets:

- `SUPABASE_URL` = the project URL
- `SUPABASE_ANON_KEY` = the publishable key

The keepalive workflow reads those two. The deploy workflow must pass them to the build as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (an `env:` block on the `npm run build` step); until it does, the published app stays in guest mode.

Locally: copy `.env.example` to `.env.local` and fill the key, then `npm run dev`.

## 5. Keepalive

`.github/workflows/keepalive.yml` calls the `keepalive_touch()` RPC once a day with the publishable key. Run it once by hand (Actions, Keep the database awake, Run workflow) and check the log says `status 200`. GitHub disables scheduled workflows in a public repo after 60 days without a commit, so a quiet repo needs a push now and then, or a second leg on cron-job.org doing a GET on `https://cmnpikpltsviyxbsszso.supabase.co/rest/v1/keepalive?select=id` with the `apikey` header.

## 6. Check it end to end

1. Open the live URL on the phone, You tab, Sign in with Google. The account picker must appear every time (the app asks for it, so a friend can switch accounts on your laptop).
2. Log a weigh-in, open the laptop, sign in: the row appears after the first sync. The You tab's Sync card reads "Synced just now".
3. Turn on flight mode on the phone, log a set, turn it off: the Sync card goes from "1 change waiting" to "Synced".
4. Sign out on the laptop: the local database is wiped (DevTools, Application, IndexedDB shows no `gym_<id>`).
5. Install the app on Android Chrome and on iPhone Safari (Share, Add to Home Screen) and sign in from inside the installed copy. The iPhone one is the known risk; if the redirect does not come back into the app, email code sign-in is the planned fallback.

## What is safe to commit

Safe: the project URL, the publishable or anon key, the Google client ID, the migrations.

Never: the `service_role` or `sb_secret` key, the database password, the Google client secret, SMTP credentials. If one leaks, rotate it in the dashboard.

## Honest line for friends

Row level security stops any user reaching another user's rows or photos from the app. The project owner can still read everything through the dashboard, photos included. The app says so under Account; say it in person too before inviting anyone.

## Delete account

Account, Delete account, confirm. The client removes the user's files under their own prefix in the `photos` bucket, calls `delete_my_account()`, which deletes the auth user and cascades every table, then wipes the local database. There is no undo and no copy left on the server.
