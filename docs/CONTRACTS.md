# Build round 1 contracts (milestones M1 to M3)

This file is the map for the parallel build. Eleven builders branch from the architect's commit on `main`, work without talking to each other, and merge back. Everything they share already exists, compiles and has one owner. PLAN.md is the product contract and wins on any conflict; docs/SPEC-critic-fixes.md overrides older spec text.

## 1. Slices, owners and ports

Run your dev server on your own port: `npm run dev -- --port <port>`. Content slices rarely need one.

| Slice | Port | Owns (may create and edit) | Reads (never edits) |
|---|---|---|---|
| engine-planner | 5201 | `src/domain/planner/**`, `src/domain/programs/**` | types, muscles, dates, units, exercise-index, machine-index, templates.json |
| engine-trend-review | 5202 | `src/domain/calc/trend.ts`, `src/domain/calc/e1rm.ts`, `src/domain/calc/targets.ts`, `src/domain/review/**` | types, muscles, dates |
| data-sync | 5203 | `src/data/sync/**`, `src/data/supabase.ts`, `src/features/auth/**`, `src/features/sync/**`, `src/app/auth/**`, `src/App.tsx`, `src/main.tsx`, `supabase/**`, `.github/workflows/keepalive.yml` | `src/data/db.ts` (schema is frozen for this round; propose a version 2 in notes) |
| content-exercises | 5204 | `src/data/library/exercises.json` | exercise-index (facts are copied verbatim, never changed) |
| images | 5205 | `public/img/**`, `src/data/library/media.json`, `scripts/build-images.mjs`, `docs/media-manifest.json`, `docs/LICENSE-repdb.md` | exercise-index, machine-index |
| content-machines | 5206 | `src/data/library/machines.json` | machine-index, exercise-index |
| content-templates | 5207 | `src/data/library/templates.json`, `src/data/library/templates.ts` | exercise-index, types (Template) |
| ui-profile-checkin | 5208 | `src/features/onboarding/**`, `src/features/checkin/**`, `src/features/you/**`, `src/features/profile/**`, `src/features/progress/**` | targets, trend, db, SyncStatus, AccountSection |
| ui-library | 5209 | `src/features/train/library/**` | exercise-index, machine-index, exercises.json, machines.json, media.json, MuscleMap, db (machine_settings, gym_profiles) |
| ui-program-home | 5210 | `src/features/home/**`, `src/features/train/program/**`, `src/features/train/TrainTab.tsx` | planner, recommender, templates, db |
| ui-logger | 5211 | `src/features/session/**`, `src/features/train/history/**` | planner, e1rm, muscles, db, MuscleMap |
| muscle-map | 5212 | `src/components/MuscleMap.tsx`, `src/assets/muscle-map.svg` | muscles (MUSCLE_INFO for the group of each muscle) |

Architect-only (do not edit; ask in `notes_for_integrator`): `src/domain/types.ts`, `src/domain/muscles.ts`, `src/domain/dates.ts`, `src/domain/units.ts`, `src/domain/parse.ts`, `src/data/library/exercise-index.ts`, `src/data/library/machine-index.ts`, `src/data/db.ts`, `src/app/routes.tsx`, `src/app/paths.ts`, `src/app/Shell.tsx`, `src/styles/app.css`, `scripts/validate-library.mjs`, `vite.config.ts`, `tsconfig*.json`, `index.html`, this file. Never `package.json` or `package-lock.json`; if a dependency is truly needed, stop and say so in `open_questions`.

New files: a builder may add files under its own folders freely, and may add a NEW file under `src/components/` when the component is generic, with a name no other slice would pick. Never edit an existing file you do not own. Tests live beside the code as `*.test.ts` (Vitest, node environment; use `import 'fake-indexeddb/auto'` for Dexie tests).

Muscle-map shares port numbering past the brief's 5201 to 5211 range because it is the twelfth slice; it rarely needs a dev server.

## 2. Hard rules (a release gate greps for them)

- No em dash and no en dash as punctuation anywhere: code, comments, docs, UI strings, JSON. Use commas, colons, full stops. The validator rejects either dash in the library JSON.
- No name of any AI model, assistant or vendor anywhere in the repo, commits or UI.
- No real personal body numbers in fixtures or seeds; synthetic values only.
- No secrets. `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` may be absent; the app must still open and work locally.
- Canonical integer units in storage: grams, millimetres, metres, seconds, kcal. Display converts through `src/domain/units.ts`. Field names say the unit (`weight_g`, `height_mm`, `distance_m`, `rest_s`).
- Day keys are local `YYYY-MM-DD` strings from `src/domain/dates.ts` (`localDateKey`, `addDays`, `diffDays`, `weekStart`). Never `new Date('YYYY-MM-DD')`, never milliseconds divided by 86400000.
- Numeric inputs: `type="text" inputMode="decimal"`, parsed by `parseDecimal` (or `parseKgToG`, `parseCmToMm`, `parseInteger`) from `src/domain/parse.ts`, which accepts a decimal comma.
- Tap targets at least 44 px; set-row controls 56 px; anything read mid-set at least 22 px bold. Inputs never under 16 px font size.
- Every number wears the `.num` class (tabular figures).
- UI copy never says "negative" or "failed". Attention items read "Needs attention" and always carry one concrete action.
- Styling: Tailwind v4 with the semantic classes from `src/styles/app.css` (`bg-bg`, `bg-surface-1/2/3`, `text-ink-1/2/3`, `text-accent-text`, `bg-accent`, `text-on-accent`, `bg-mint`, `text-mint-text`, `text-rose-text`, `border-line`, `rounded-card`, `rounded-control`, `rounded-sheet`). No new colour literals.
- Git: commits authored by ri1wik (already configured). Plain commit messages. No trailers of any kind.
- Before finishing: `npm run typecheck`, `npm test` and `npm run build` pass in your tree, and `node scripts/validate-library.mjs` passes for content slices.

## 3. Shared vocabulary (src/domain/types.ts)

- 11 body parts (`BODY_PARTS`), 14 scored groups (`MUSCLE_GROUPS`), 22 muscles (`MUSCLES`). The map between them is `MUSCLE_INFO` in `src/domain/muscles.ts`. Five muscles earn no body-part credit: lower_back, front_delts, rotator_cuff, hip_flexors, tibialis. Front delts still count at the group level (`groupCredits`) because the split catalogue prints them.
- `MOVEMENT_PATTERNS`: the twenty from docs/SPEC-programming.md plus six additions the catalogue needs (hip_abduction, hip_adduction, wrist_flexion, shrug, carry, anti_rotation).
- `EQUIPMENT` (nine specific values) and `EQUIPMENT_FAMILIES` (the six the substitution rule scores); `EQUIPMENT_FAMILY_OF` maps between them.
- `LoadType`: weight, bodyweight, assisted, time. Assisted loads carry `assist_g` as a positive number on its own axis; they never enter e1RM or key-lift signals.
- `BarType`: olympic (20 kg), ez (10 kg), fixed (10 kg floor). `BAR_FLOOR_G`.
- Synced rows: every table carries `id, created_at, updated_at, version, deleted_at` plus the local-only `dirty: 0 | 1` (`LOCAL_ONLY_FIELDS` lists what the sync layer strips). `profiles` is owned through `id`; everything else through `user_id` (`OWNER_COLUMN`). `foods` and `portions` are the shared catalogue (`SHARED_TABLES`).
- Deterministic ids: `body_weights` id derives from (user_id, date_key) and `photos` from (user_id, date_key, pose) with uuid v5 so two devices merge; the sync slice publishes the helper in `src/data/sync/ids.ts` and the check-in slice uses it.
- `Workout.finished_at` and `deleted_at` are one-way: non-null wins in the merge whatever the receipt order.

## 4. The library

Structural facts are TypeScript and final for this round: `src/data/library/exercise-index.ts` (exactly 85 exercises, `EXERCISE_IDS`, `EXERCISES_BY_ID`, `KEY_LIFT_IDS`) and `src/data/library/machine-index.ts` (45 machines and stations, `MACHINE_IDS`, `DEFAULT_GYM_MACHINE_IDS`). Content slices add prose in JSON next to them:

- `exercises.json`: an array of full `Exercise` rows (`ExerciseIndexEntry & ExerciseContent`). Copy the index fields verbatim; the validator fails any structural field that differs. Add `aliases`, `cue` (one original line), `howTo` (exactly 4 lines), `mistakes` (exactly 3), `repMin`, `repMax`, `incrementG`, `restS`, and `media: null` (the images slice fills media separately).
- `media.json`: `Record<exerciseId, ExerciseMedia>` written by the images slice, with `docs/media-manifest.json` recording source, licence, author and URL for every shipped file. Illustrations come only from the RepDB free tier (credit line already in the You tab and README) or the user's own photos.
- `machines.json`: an array of full `Machine` rows (`MachineIndexEntry & MachineContent`). Every machine has `photo` or `placeholder: true`; at least three aliases each; setup steps use the labels Seat, Pad, Grip, Pin, Foot plate, Other.
- `templates.json`: an array of `Template` (five splits: `ppl_6`, `ppl_5`, `upper_lower_4`, `full_body_3`, `minimal_2`), each day's items referencing exercise ids, with `is_key_lift` on the first compound of each day. `templates.ts` exports `TEMPLATES`, `TEMPLATES_BY_KEY` and `DEFAULT_TEMPLATE_KEY = 'ppl_6'`.

Validate with `node scripts/validate-library.mjs` (also run by Vitest). The script loads the TypeScript index files directly through Node's type stripping, which is why `types.ts`, `exercise-index.ts` and `machine-index.ts` use explicit `.ts` import extensions and only `import type` for anything outside themselves. Keep that if you ever touch them.

## 5. The local database (src/data/db.ts)

`openUserDb(userId)` returns the Dexie instance `gym_<userId>`; `GUEST_USER_ID = 'local'` before sign-in; `deleteUserDb` on sign-out. Tables are the thirteen server tables plus `outbox` and `meta`; `SCHEMA_V1` lists the indexes; `META_KEYS` lists the meta keys so slices never collide. UI slices read and write through Dexie only. Until the sync slice lands, write rows with `dirty: 1` and `version: 1` and let the outbox stay empty; the sync slice's `write()` helper (`src/data/sync/write.ts`, one transaction for row plus outbox) replaces direct `put` calls at integration. Make your writes go through one small function in your own folder so that swap is one line.

## 6. Calling the stubs

Every domain function in `src/domain/planner/index.ts`, `src/domain/calc/trend.ts`, `src/domain/calc/e1rm.ts`, `src/domain/review/index.ts` and `src/domain/programs/recommender.ts` has its exact signature, JSDoc and types, and throws `Error('not implemented: <name>')` until its owner lands. UI slices:

1. Import the function and its types from the stub module. Build against the types, never against a guessed shape.
2. Put the call behind one adapter in your own folder (for example `src/features/session/plan.ts`). While the stub throws, the adapter catches the `not implemented` error and returns a fixture typed as the contract's output, so your screen renders and your tests run. Keep the fixture small and synthetic.
3. At integration, delete the catch; the engine's real output flows through the same adapter.

Engine slices: implement the function in place, keep the exported names and the type shapes, and extend types only with optional fields. Pin the fixtures named in PLAN.md and docs/SPEC-programming.md as tests.

Stub components the You tab imports: `src/features/sync/SyncStatus.tsx` and `src/features/auth/AccountSection.tsx` (owner data-sync). Stub component the library and logger import: `src/components/MuscleMap.tsx` (owner muscle-map; props are the contract).

## 7. Routes (src/app/routes.tsx, src/app/paths.ts)

Registered and pointing at placeholder components you replace in place:

| Path | Component | Owner |
|---|---|---|
| `/onboarding` | `features/onboarding/OnboardingScreen` | ui-profile-checkin |
| `/signin` | `features/auth/SignInScreen` | data-sync |
| `/` | `features/home/HomeTab` | ui-program-home |
| `/train` (redirects to program) | `features/train/TrainTab` (segment bar) | ui-program-home |
| `/train/program` | `features/train/program/ProgramScreen` | ui-program-home |
| `/train/library` | `features/train/library/LibraryScreen` | ui-library |
| `/train/history` | `features/train/history/HistoryScreen` | ui-logger |
| `/train/exercise/:id` | `features/train/library/ExerciseDetailScreen` | ui-library |
| `/train/machine/:id` | `features/train/library/MachineDetailScreen` | ui-library |
| `/session/:id` (full screen, outside the Shell) | `features/session/SessionScreen` | ui-logger |
| `/checkin` | `features/checkin/CheckinScreen` | ui-profile-checkin |
| `/food` | `features/food/FoodTab` | later milestone |
| `/progress` | `features/progress/ProgressTab` | ui-profile-checkin |
| `/you` | `features/you/YouTab` | ui-profile-checkin |

Link with `PATHS.exercise(id)` and friends from `src/app/paths.ts`; never a typed path string.

## 8. What to return when you finish

`notes_for_integrator`: anything another slice must do at merge (a type field you need added, a fixture to delete, a stub you called in a way that needs the real engine). `open_questions`: only things that change the build. Keep both short.
