# Cloud architecture, sync and photos

Reference material for builders. PLAN.md wins on any conflict.

## Recommendation

Build on Supabase Free (Mumbai region): Postgres with row level security, Supabase Auth with Google sign-in first, and one private Storage bucket for photos, all behind a thin sync layer you write yourself (Dexie on IndexedDB as the read source, an outbox of pending upserts, server receipt order plus a trigger-kept version counter as the only conflict rule). Firebase is rejected because Cloud Storage is no longer available on the no-cost Spark plan: the pricing page marks every Storage row as not applicable on Spark, and since 3 February 2026 Spark buckets return 402 and 403, so photos would force a credit card on file. PowerSync, Convex, InstantDB and Appwrite are not worth their learning curve or their tighter caps for data this small. Keep the project alive with your own daily traffic plus a GitHub Actions ping every 3 days, and treat the 1 GB storage cap as the real ceiling: at roughly 55 MB of photos per user-year it supports about 18 user-years before Pro at 25 USD per month becomes the next step.

## Backend comparison (verified figures)

- Supabase Free (chosen): 2 active projects, 500 MB Postgres, 1 GB file storage, 5 GB egress plus 5 GB cached egress, 50,000 MAU, social OAuth included, custom SMTP included, no card. Known costs: projects pause after 1 week of low user database activity (restore is one click within a year, data intact), the default mailer is limited to about 2 auth emails per hour and since 3 June 2026 new free projects cannot edit email templates unless they bring their own SMTP, image transformations are Pro-only, no built-in offline sync, no automatic backups on Free.
- Firebase: Firestore Spark gives 1 GiB stored, 50K reads, 20K writes, 20K deletes per day, 10 GiB egress per month, Auth 50K MAU, and the best offline persistence in the market. But Cloud Storage requires Blaze: the pricing page lists Storage as not applicable on Spark, and the storage FAQ says Spark projects lost console and API access to default buckets on 3 February 2026. Blaze means a card on file with no hard spending cap (budget alerts only). Storing photos inside Firestore documents (1 MiB limit, reads billed) is a hack. If you ever accept a card, Firebase saves the 2 to 3 sync evenings; for a free-first app it is out.
- PowerSync Cloud Free: 500 MB hosted data, 2 GB synced per month, 50 peak connections, 2 instances, and Free instances are deprovisioned after 7 days without deploys or client connections (a second thing to keep alive). Pro is 49 USD per month. You still write the upload connector yourself, plus sync-rules YAML and SQLite WASM in the browser. Not worth it: the per-user dataset is tiny and the DIY outbox is a few hundred lines.
- Convex: free 0.5 GB database, 1 GB file storage, 1 GB egress per month, built-in realtime and file storage with no card, but no offline persistence and 1 GB egress is tight once photos are viewed; one line, not chosen.
- InstantDB: free 1 GB, unlimited requests, no pausing, client cache with optimistic writes (offline-friendly by design), 30 USD Pro; the strongest fallback if the DIY sync ever feels wrong, but younger, graph-style schema, and file storage is newer.
- Appwrite Cloud: free tier is shared across the organisation, 2 projects, 2 functions per project since January 2026, realtime capped at 2M messages per month from 30 April 2026, about 2 GB storage and 5 GB bandwidth per third-party tables; no offline story; smaller ecosystem; not chosen.

## Sign-in for you and your friends

- Google sign-in first, through Supabase Auth (provider: Google, redirect flow, never popup, because popups are unreliable inside an installed PWA). Phone friction is one tap into the account picker; most friends in India already have a Google account. Setup: a Google Cloud OAuth web client, consent screen set to External and published to In production with only openid, email and profile scopes (no verification needed for those), redirect URI https://<project-ref>.supabase.co/auth/v1/callback, authorised JavaScript origin https://ri1wik.github.io; paste client ID and secret into Supabase, add https://ri1wik.github.io/gym-tracker/** and http://localhost:5173/** to the redirect allow-list, set Site URL to the Pages URL.
- Hash router detail: supabase-js v2 uses PKCE, so Google returns to https://ri1wik.github.io/gym-tracker/?code=... and the app (detectSessionInUrl: true) exchanges it; strip the query with history.replaceState afterwards so the hash route stays clean. The PKCE verifier lives in localStorage, so the round trip must land in the same browser profile.
- Email second, and as a 6-digit OTP rather than a magic link: a magic link tapped on a phone opens in the default browser, not the installed PWA, so the session lands in the wrong place; a code is typed inside the app. OTP needs the {{ .Token }} template edit, which on new free projects requires custom SMTP. Free SMTP that needs no owned domain: Brevo (300 emails per day, verified sender address) or Gmail with an app password (about 500 per day). Resend (3,000 per month) needs a domain you control, which github.io is not. Ship Google only in week 1, add OTP when the first friend without Google asks, or if iOS PWA OAuth proves flaky.
- Friends-only signups: optional 10-line trigger on auth.users insert that raises unless the email is in an allowed_emails table; otherwise anyone with the URL can create an empty account, which costs nothing against 50K MAU but is untidy.

## Offline story and sync layer (keep it this simple)

- Local store: Dexie on IndexedDB with one table per synced server table, same columns, plus local flags (dirty). The UI reads only from Dexie; it never awaits the network on the Train screen. This also covers the Supabase pause case: the app keeps working and syncs after you press Resume.
- Writes: every mutation writes Dexie first, then appends an outbox row {id, table, row_id, op, payload, created_at}. Row ids are client-generated UUIDs, every push is an upsert, so a retry after a timeout cannot duplicate. Flush on the online event, on visibilitychange to visible, and right after a write when navigator.onLine is true; exponential backoff on network errors; a 4xx (RLS or validation) moves the item to a dead state and the You tab shows one line, 'N changes could not sync', never a stuck queue.
- Server is the source of truth: each table has version int default 1 and updated_at timestamptz, both set by a BEFORE UPDATE trigger (version = old.version + 1, updated_at = now()); clients never send either. Conflict rule is last writer wins by server receipt order, at row level. Phone and laptop editing the same row within the same minute: the later server receipt overwrites the whole row. Acceptable because sets are their own rows (set 3 on the phone and set 1 on the laptop never collide); only profiles and program settings are genuinely shared, and those change rarely.
- Pull: per table, select where user_id = me and updated_at >= cursor minus 2 minutes, ordered, paged by 1000; cursor stored in a Dexie meta table. Merge is one pure function under Vitest: if no local row take remote; if local is dirty keep local (the flush will resolve it); else take remote when remote.version >= local.version. Soft deletes via deleted_at so deletions propagate; tombstones are never purged (rows are tiny).
- Auth offline: supabase-js keeps the session in localStorage; access tokens last an hour and refresh needs the network, so the flush refreshes first. Offline logging never touches auth.
- Wrap one generic syncTable(name) so the layer is written once; add a table by listing it in a config array.

## Schema, RLS and indexes (Postgres)

- Tables, all with id uuid pk, user_id uuid references auth.users on delete cascade, created_at, updated_at, version, deleted_at: profiles (id = auth user id, display_name, sex, birth_date, height_mm, activity_factor, goal jsonb), body_weights (date_key text, weight_g int, note; unique user_id + date_key), photos (weighin_id, pose text check in front, side, back, date_key, storage_path, thumb_path, width, height, bytes; unique user_id + date_key + pose), programs (template_key, split, days_per_week, started_on, settings jsonb, active), workouts (program_id, planned_on date_key, session_key, started_at, finished_at, status, notes), workout_sets (workout_id, exercise_key text from the bundled library, set_index, kind warmup or working, target_reps, target_load_g, reps, load_g, rpe, completed_at, rest_s), cardio_sessions (date_key, kind, duration_s, distance_m), foods (user_id nullable: null means the seeded Indian library, name, brand, per_100g jsonb holding every macro, vitamin and mineral key, source), food_logs (date_key, meal, food_id, grams, snapshot jsonb of nutrients at log time). Weekly review is computed client-side from synced rows; no table.
- RLS on every table. Pattern: for select, update, delete using ((select auth.uid()) = user_id); for insert with check ((select auth.uid()) = user_id); foods select adds or user_id is null. The (select ...) wrapper lets Postgres use the index.
- Grants are now explicit: since 30 May 2026 new Supabase projects do not expose new public tables to the Data API until you grant; run grant select, insert, update, delete on each table to authenticated, and grant nothing to anon (except a one-row keepalive table with select to anon and a using (true) policy, used only by the ping).
- Indexes: (user_id, updated_at) on every synced table for the pull query; (user_id, date_key) on body_weights, food_logs, cardio_sessions; (workout_id) on workout_sets; (user_id, planned_on) on workouts. A handle_new_user trigger inserts the profiles row on signup.
- Keep migrations in the repo under supabase/migrations so the schema is reproducible by the CLI and readable by the coding assistant.

## Realtime

- Not in v1. Supabase Realtime is free (200 peak connections, 2 million messages per month) but a live laptop mirror while the phone logs is a demo, not a need; it adds a websocket per open tab and a second code path into the local store.
- Instead: pull on visibilitychange and after every flush. The laptop shows the phone's session within a second of being focused. Add Realtime later as a one-screen opt-in (subscribe to workout_sets for the active workout) if you find yourself wanting the live view.

## Photos

- Capture with input type=file accept=image/* capture=environment. Decode through an img element (browsers apply EXIF orientation on img by default), draw to a canvas at 1080 px long edge, toBlob image/jpeg at 0.8, and a second 320 px thumbnail at 0.7 since image transforms are Pro-only. The re-encode strips EXIF including GPS, a privacy win worth stating in the app.
- Storage: one private bucket photos, paths <user_id>/<date_key>/<pose>.jpg and <pose>_thumb.jpg. RLS on storage.objects for all four operations: bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text. Upload order: file, then thumb, then the photos row; the upload itself sits in the outbox as a blob in IndexedDB so a weigh-in in a dead spot still completes.
- Display: thumbs downloaded through the authenticated client and cached in IndexedDB so the compare screen works offline; full size via createSignedUrl with a 1-hour expiry on tap. Compare screen: two dates side by side, same pose, later a ghost overlay with an opacity slider.
- Sizes: a 1080 by 1440 portrait at q0.8 is about 200 to 350 KB, a thumb about 20 KB. Weigh-in every 4 days is about 91 per year; front plus side is about 183 photos, roughly 55 MB per user-year including thumbs. 1 GB free is about 18 user-years: you alone for many years, you plus 9 friends for under 2 years. Egress is not the constraint: 10 users viewing 30 comparisons a month is well under 200 MB.
- Export: a button on the You tab lists the user's folder, downloads each object through the client and zips them client-side with fflate, alongside a JSON dump of every table. No server function needed.

## Privacy, security and the public repo

- Isolation between friends is RLS plus the per-user storage prefix; nothing in the client can reach another user's rows or files. Be honest with friends that the developer can see everything through the dashboard and the service role, photos included. Client-side encryption would fix that but breaks forgot-passphrase recovery and cross-device sync of the key; not recommended.
- Delete account: client removes the user's storage objects (RLS permits own prefix), then calls an RPC delete_my_account() (security definer, deletes from auth.users where id = auth.uid(), execute granted to authenticated only); every table cascades from auth.users. Deleting storage.objects rows by SQL does not remove files, hence the client-side removal first.
- Safe to commit: the Supabase URL and the anon or publishable key (sb_publishable_...), the Google client ID, the migrations. Never commit: service_role or sb_secret key, the database password, the Google client secret (lives only in the Supabase dashboard), SMTP credentials. The keepalive workflow reads the URL and anon key from repo secrets for hygiene even though they are public.
- Hardening that costs nothing: no grants to anon beyond the keepalive table, email signups disabled while Google-only, Site URL and redirect allow-list set exactly, the optional allowed_emails trigger.

## Keeping the Free project alive

- Your own logging is user database activity and is enough on its own; the ping is insurance for a holiday week when nobody trains.
- GitHub Actions workflow on a cron every 3 days plus workflow_dispatch, doing a GET on /rest/v1/keepalive?select=id with the apikey header, so it is database traffic and not just an auth health check. Watch the GitHub rule: scheduled workflows in a public repo are disabled after 60 days without repo activity, so the schedule only survives while you keep committing; cron-job.org is a free second leg if you want belt and braces.
- Supabase emails a warning about a week before pausing; make sure the project owner email is one you read.

## Cost ceiling on Free

- Database is not the limit: a heavy user writes under 10 MB a year (about 7,500 set rows and 1,800 food logs with nutrient snapshots), so 500 MB is around 50 user-years.
- 10 users: DB about 100 MB per year, photos about 550 MB per year, so the 1 GB storage cap arrives in year 2. Before paying: keep full-size photos for 12 months and thumbs forever, or drop full-size to 900 px at q0.75 (about 130 KB).
- 50 users: photos cross 1 GB in about 4 months and DB in about a year; Pro at 25 USD per month (8 GB DB, 100 GB storage, 250 GB egress, no pausing, backups) is the honest answer.
- 200 users: Pro still fits (about 11 GB of photos per year) at roughly 25 to 35 USD per month. MAU never matters at this scale.

## Build effort (3-hour evenings)

- Evening 1: Supabase project, migrations, RLS, grants, Google provider, keepalive workflow. Needs the Google Cloud console steps from the user first.
- Evening 2: sign-in screen, PKCE redirect with the hash router, session state, sign-out, profile bootstrap, test on Android Chrome and iOS Safari and both installed PWAs.
- Evenings 3 to 5: Dexie schema, generic syncTable, outbox, flush with backoff and dead state, pull cursor, merge function under Vitest, sync status line on the You tab. This is the riskiest slice; finish it before any food or program work depends on it.
- Evenings 6 to 7: photo capture, resize, thumb, queued upload, cached thumbs, signed URLs, compare screen.
- Evening 8: delete account RPC and flow, JSON plus photo export, the allowed_emails trigger if wanted. About 8 evenings for the whole cloud slice.

## Must have

- Supabase Free project in ap-south-1 (Mumbai) with migrations committed under supabase/migrations
- RLS on every table and on storage.objects, explicit grants to authenticated only, nothing to anon except the keepalive table
- Google sign-in via redirect flow with the Pages URL and localhost on the redirect allow-list; PKCE code exchange handled before the hash router renders
- Dexie-backed local store as the only read source for the UI, with an outbox of idempotent upserts keyed by client UUIDs
- Trigger-maintained version and updated_at on every synced table; merge rule as a pure function under Vitest
- Soft deletes (deleted_at) so deletions reach the other device
- Per-table pull cursor on updated_at with a (user_id, updated_at) index
- Private photos bucket, path prefix = user id, client-side 1080 px q0.8 JPEG plus 320 px thumb, upload queued through the outbox
- Thumbnails cached in IndexedDB; full size via signed URLs
- GitHub Actions keepalive hitting the REST API every 3 days
- Delete-account flow (client removes files, RPC deletes the auth user, cascades) and a client-side JSON plus photo export
- Sync status and dead-letter notice on the You tab, never a silent stuck queue

## Later

- Email 6-digit OTP sign-in via Brevo or Gmail app-password SMTP, when a friend without Google appears or iOS PWA OAuth misbehaves
- Supabase Realtime subscription for a live laptop mirror of the active workout
- Optimistic concurrency (update where version = base) for profiles and program settings only, if LWW ever bites
- Photo retention policy (full size for 12 months, thumbs forever) or lower full-size target when storage passes 700 MB
- Pro plan at 25 USD per month once friends push past about 15 user-years of photos, which also removes pausing and adds backups
- Ghost overlay compare with opacity slider
- allowed_emails signup trigger if random signups become a nuisance
- Monthly tombstone purge and cursor reset, only if the pull query ever gets slow

## Risks

- Project pausing after 7 days of low activity: mitigated by daily use plus the ping, but GitHub disables scheduled workflows after 60 days without commits, and the docs do not promise that automated pings count; the outbox design means a pause costs only a Resume click, not data
- 1 GB photo storage is the first hard wall; it arrives in year 2 with ten friends and in months with fifty
- iOS installed PWA has its own storage, so a session created in Safari does not carry into the PWA and the Google redirect inside the PWA must be tested on a real iPhone; the OTP fallback exists for this
- Last-writer-wins can overwrite a concurrent edit of the same row from two devices; the per-set row design keeps that window to profile and program settings
- Supabase tightened free-tier email in June 2026 and the Data API grants on 30 October 2026; the free plan can change again, so keep the schema in migrations and the sync layer generic so a move to InstantDB or Pro is a config change, not a rewrite
- The developer can read all friends' data and photos; say so before inviting anyone
- No automatic backups on Free: a bad migration is unrecoverable from the server side, so take a pg_dump through the CLI before every schema change
- Google consent screen must be published to production with only basic scopes; left in Testing, only 100 listed test users can sign in
- Supabase reports at most two active free projects per organisation; use the CLI local stack or a throwaway second project for development, not a third
