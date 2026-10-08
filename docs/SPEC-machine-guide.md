# Machine guide, what-next and images in the app

Reference material for builders. PLAN.md wins on any conflict.

## Recommendation


## Data model (static JSON in the repo, user state in the backend)

- src/data/equipment.json: { id, name, aliases[], brand?, category: 'plate-loaded' | 'selectorised' | 'cable' | 'free-weight' | 'cardio' | 'bodyweight', photo: { src, w, h, credit, source: 'own' | 'library' | 'user' }, muscles: { primary[], secondary[] } using the 14 muscle-map region ids, setup: [{ label: 'Seat' | 'Pad' | 'Grip' | 'Pin' | 'Foot plate', text }], exerciseIds[], tips[] }. Aliases carry the names people actually use ('pulldown', 'Hammer high row', 'pec deck', 'the leg press by the window').
- src/data/exercises.json: { id, name, bodyPart (one of the 11 plus cardio), pattern: 'horizontal-push' | 'incline-push' | 'vertical-push' | 'vertical-pull' | 'horizontal-pull' | 'hinge' | 'squat' | 'lunge' | 'elbow-flex' | 'elbow-extend' | 'wrist' | 'calf-raise' | 'hip-abduct' | 'hip-adduct' | 'trunk-flex' | 'anti-rotation' | 'cardio', equipmentId, muscles: { primary[], secondary[] }, images: { start, end }, howTo: [4 strings], mistakes: [3 strings], loadType: 'per-side' | 'stack' | 'bar' | 'dumbbell' | 'bodyweight', unilateral: boolean }.
- User state (backend, per user): machineSettings { equipmentId: { seat, pad, grip, note } } so the app remembers 'seat 4, pad 2' per machine; this is the single highest-value field for a confused person at a machine. Plus performance history per exerciseId for last performance and PRs, and the gym profile below.
- Images live under public/img/exercises/<id>/start.webp and end.webp, public/img/equipment/<id>.webp, with public/img/t/<same path> for 160 px thumbnails. Paths are derived from ids, so the JSON never stores a URL for library images.

## Image sourcing and pipeline (the part most likely to stall the project)

- Machines: photograph them yourself at Anytime Fitness in one visit, about 45 frames, portrait, machine centred, no people in frame, phone in HEIC or JPEG. This is the only legal source of real machine photos; Hammer Strength, Life Fitness, Precor, Matrix and Technogym product shots are copyrighted marketing material and must not be bundled, even scaled down.
- Exercises: the Free Exercise DB on GitHub (yuhonas/free-exercise-db) is released under the Unlicense (public domain) and ships two photos per exercise (start and end, model on a white background) for about 870 exercises, which covers nearly all 85. Copy the pairs for the 85 ids into the repo; where an exercise is missing, shoot it yourself or use a wger image with its CC BY-SA attribution shown on the detail page.
- Pipeline: scripts/build-images.mjs with sharp strips EXIF (GPS included), resizes to 480 px wide WebP quality 72 (about 20 to 35 KB each), writes a 160 px thumbnail (about 4 to 7 KB), and records width and height into the JSON so layouts never shift while loading.
- Budget: 170 exercise images at about 30 KB is 5 MB, 45 machine photos at about 35 KB is 1.6 MB, 215 thumbnails at about 6 KB is 1.3 MB, plus one 30 KB SVG. Whole library about 8 MB, well inside a phone's cache quota.
- Until a machine is photographed, the entry carries photo: null and placeholder: true; the card shows a category icon with the machine name and an 'Add a photo' prompt, so the app ships before the photo session is complete and the validator still passes.

## Equipment view in the library

- Library gets a segmented control: By body part | By equipment. The equipment tab is a photo grid (thumbnails, 2 columns on phones) with filter chips for plate-loaded, selectorised, cable, free weights, cardio, and a search box that matches name and aliases. A 'My gym only' toggle, on by default once a gym profile exists, hides machines the gym does not have.
- Equipment detail: hero photo (480 px, tap for full screen), muscle map mini figure with primary and secondary highlighted, a setup checklist (seat, pad, grip, pin, foot plate) with the user's saved settings shown beside the generic guidance and editable in place, the list of exercises this machine supports with their start thumbnails, and tips (for example 'press through the heels, do not lock the knees').
- A 'Start this' button on each exercise row: if a session is active it inserts the exercise at the current position; if not, it starts an ad-hoc session with that exercise. The button is the bridge from being confused to actually training.
- Brand note shown as a small label ('Hammer Strength plate-loaded') because the user recognises the frame colour and badge before the exercise name.
- Searchable aliases are the reason the search works in the gym: seed every machine with at least 3 aliases, and let the user add their own ('the red one') which are stored in the gym profile and visible to friends in the same gym.

## Exercise detail page

- Top: two images side by side labelled Start and End; on narrow screens the pair collapses to one image with a tap-to-toggle and a tiny position indicator. Below them, the equipment card (photo thumbnail, name, 'Setup' link to the machine entry and the user's saved seat and pad).
- Muscle map: the shared SVG component in highlight mode, primary in the accent colour, secondary in the soft tint, with a text line underneath ('Primary: lats. Secondary: biceps, rear delts') for accessibility.
- Performance block: last session (date, sets as weight x reps), best weight, best estimated 1RM (Epley), best volume set, and a 6-point sparkline of e1RM over the last 6 sessions. This reads from the user's history and is the part that makes the page worth opening between sets.
- 'Swap for': exercises with the same primary muscle and the same pattern on different equipment, each row with its start thumbnail and a label of the equipment category, filtered to the gym profile, with a 'Show all gyms' link. Tapping swaps it into the active session or opens the detail when no session is running.

## 'What next' inside the active session

- Trigger: the user logs the last prescribed set of an exercise, or taps 'Machine busy' on the current exercise. Either opens the What next bottom sheet; it never auto-navigates away from the set logger.
- The sheet shows the next prescribed exercise as a large card: start photo, name, target sets x reps and the load suggestion from last time, the machine thumbnail and the saved seat and pad settings, and the rest timer still running in the header. Buttons: 'Go' (advances), 'Busy, swap' (expands the substitution list), 'Later' (moves it to the end of today's queue).
- Substitution list: up to 4 rows, each with a photo, built by the rule same primary muscle AND same pattern AND different equipmentId, filtered to the gym profile, excluding exercises already done today, ranked by equipment similarity (plate-loaded to selectorised first, then cable, then free weights, then bodyweight). A fifth row 'Different pattern, same muscle' opens the wider list.
- Tapping a substitute replaces the exercise for today only and records the swap on the session (so the history shows 'did Hammer chest press instead of bench press'); a secondary 'Always prefer this' switch edits the program template.
- Target the sheet at one thumb: full-width rows, 56 px tall minimum, photos on the left, and no text input anywhere in the flow. The gym is where the user has sweaty hands and 90 seconds.

## Confused at a machine: v1 search, later snap

- v1: a persistent 'What is this machine?' button on the session screen and in the library opens a full-screen search with photo results, matching name, aliases and body part, filtered to the gym profile; results show photo, name, the muscles line and a 'Start this' button. Typing is optional: the first screen shows the equipment grid for the body part the user is currently training, since confusion usually happens mid-session.
- Cost control: scans require a signed-in user, 30 scans per user per day enforced in the function, images capped at 1024 px, and the candidate list limited to the user's gym (fewer tokens, better accuracy). At 5 friends doing 10 scans a week the bill is cents a month on any model.
- Privacy notes to show in the app: the photo is sent to the serverless function and to the model provider, processed and discarded, not stored by the app unless the user chooses 'Attach to my gym'; EXIF and GPS are stripped on the phone before upload; other members may be in frame, so the camera screen says 'frame the machine only, no people'; the model provider retains API inputs for a limited period under its standard policy, which the friends must be told once in the settings screen.
- User-attached gym photos (later, with snap): on an equipment entry the user can 'Add my gym's photo', stored in the backend's object storage (Supabase Storage 1 GB free or Cloudflare R2 10 GB free) under the gym id, so everyone in that gym profile sees the real machine on top of the library photo. Same downsizing and EXIF strip, a 'no people' rule, and the uploader can delete it.

## Gym profile

- GymProfile { id, name, ownerUserId, equipmentIds[], customAliases{}, machinePhotos[] }. A user belongs to one active gym and may switch; a friend who joins an existing gym profile inherits its equipment list instead of ticking 45 boxes again.
- Setup is a photo checklist: the equipment grid with a tick on each card, grouped by category, with 'Select all plate-loaded' style shortcuts. Seeding: ship a default profile 'Anytime Fitness (typical)' with the full list ticked so day one works without setup.
- Everything that suggests equipment reads the profile: the substitution list, the swap-for list, the library's 'My gym only' toggle, the snap candidate list, and program templates (an exercise whose machine the gym lacks is flagged at program creation with a one-tap swap).
- Friends in another gym create their own profile; nothing in the library JSON is gym-specific, only the profile and its photos are. Keep the profile small (a few KB) so it syncs on a weak signal.

## Offline: images in the gym without signal

- Service worker via vite-plugin-pwa (Workbox). The precache manifest includes the app shell, the two JSON catalogues, the SVG muscle map and all 160 px thumbnails (about 1.3 MB); it does not include the 480 px images, so an install is fast and every grid and search result still shows a picture offline.
- Runtime route for /img/**: CacheFirst with ExpirationPlugin (maxEntries 600, maxAgeSeconds 180 days, purgeOnQuotaError true). Any image viewed once stays available.
- Program-first warming: whenever a program is saved or the next session is scheduled, the app posts the list of that program's start, end and machine images to the service worker, which fetches them in chunks of 10 (about 40 images, 1.2 MB) when the page is idle, preferring Wi-Fi when navigator.connection reports it. The user's own program is therefore always complete before they walk in.
- Settings has 'Download the whole library for offline' (about 8 MB) with a progress bar, which calls navigator.storage.persist() first and shows navigator.storage.estimate() so the user sees the cost. User-attached gym photos warm through the same path after sync.
- iOS: Safari may evict script-writable storage after 7 days without use for a site in a tab, but not for a PWA added to the home screen, so the onboarding tells the user to install it. Keep the total under about 50 MB to stay clear of Safari's historic per-origin quota and never bundle images into the JS.

## SVG muscle map: one original figure, reused three times

- One file, src/assets/muscle-map.svg, viewBox 0 0 400 600, front figure in the left half and back figure in the right half, drawn as simple filled shapes (no shading) in the app's line colour, so it reads at 120 px in a card and at 360 px on the detail page.
- 14 highlightable regions as <g data-muscle='...'> groups (both sides of a symmetrical pair in one group): chest, shoulders, biceps, forearms, abs, obliques, quads on the front; traps-upper-back, lats, rear-delts, triceps, lower-back, glutes, hamstrings, calves on the back (calves and forearms appear on both figures but share one group). Each maps to the 11 body parts in the library and gives the extra detail (lower back, rear delts, obliques) that the body-part list lacks.
- Component <MuscleMap primary={ids} secondary={ids} heat={{id: value}} mode='highlight' | 'heat' size /> styles groups through CSS classes: .primary fills the accent, .secondary fills the soft tint, heat mode uses a 5-step scale from the dataviz palette with a legend. The SVG is inlined once as a React component so classes can be toggled without re-fetching.
- Reuse: exercise detail and equipment detail (highlight mode), session summary (heat by sets per muscle for today), weekly volume (heat by sets per muscle over 7 days against a 10 to 20 set target band, tapping a region lists the exercises that fed it).

## Acceptance checks for this lens

- From the session screen, with the phone in airplane mode, the user can find any machine in their gym by name or alias and see its photo and setup within 3 taps.
- Finishing the last set of an exercise shows the next exercise with its photo in under one second; 'Busy, swap' shows at least 2 substitutes with photos for every exercise in the default program, and none of them names a machine the gym profile lacks.
- Every one of the 85 exercises renders two images and a 4-line how-to; every machine renders a photo or a placeholder, never a broken image.
- The muscle map highlights the correct regions for 10 randomly checked exercises and the weekly heat view sums sets correctly against logged history.
- Whole-library download reports about 8 MB and the program images for the next session are cached without the user doing anything.

## Must have

- Equipment tab in the library with photo grid, category filters, alias search and 'My gym only' toggle
- Equipment detail with hero photo, muscles, setup checklist with per-user saved seat, pad and grip settings, supported exercises and a 'Start this' button
- Exercise detail with start and end images, 4-line original how-to, 3 common mistakes, muscle map, last performance and PRs, and a swap-for list by pattern
- 'What next' bottom sheet on finishing an exercise or tapping 'Machine busy', with the next exercise's photo and a one-tap substitution list where every row has a photo
- Substitution rule: same primary muscle, same pattern, different equipment, filtered to the gym profile, excluding today's done exercises, ranked by equipment similarity
- 'What is this machine?' search by name, alias or body part with photo results, reachable from the session screen
- Gym profile: tick which machines the gym has, joinable by friends, read by every suggestion surface, with a seeded 'Anytime Fitness (typical)' default
- Own photos of about 45 machines plus Free Exercise DB (public domain) start and end photos, converted to 480 px WebP with 160 px thumbnails, EXIF stripped, about 8 MB total
- Build-time validator that fails on missing images, bad muscle ids, dangling equipment or substitution ids, or how-tos that are not 4 lines
- Service worker: precache shell, catalogues, SVG and all thumbnails; CacheFirst runtime cache for full images with a 600-entry cap; program-first warming of the next session's images; 'Download whole library' in settings
- One original SVG muscle map (front and back, 14 regions) as a React component with highlight and heat modes, reused on exercise detail, equipment detail, session summary and weekly volume

## Later

- User-attached photos of their own gym's machines stored per gym profile in object storage, visible to friends in the same gym, with delete and a 'no people in frame' rule
- User-added aliases per gym ('the red one by the window') and an optional zone label per machine so 'What next' can say where the machine is
- Short looping clips (3 to 5 seconds, under 300 KB) for the 15 exercises people most often perform wrong, lazy-loaded and never precached
- Friends sharing their saved seat and pad settings as a starting point for a new member of the same gym
- 'Different pattern, same muscle' deeper substitution browser and a 'why this swap' line explaining the ranking
- Program authoring warnings that flag any exercise whose machine the gym profile lacks and offer the swap at planning time

## Risks

- Image rights: manufacturer product photos are the easiest to grab and the one thing that cannot ship; the credit field and the release gate exist to catch this, and the whole machine lane depends on one photo session at the gym actually happening
- The photo session itself: 45 machines with no people in frame takes an off-peak visit; until it happens machine cards are placeholders, which weakens the 'confused at a machine' promise
- iOS Safari storage: a tab-based install can lose the image cache after 7 days unused; the onboarding must push home-screen install, and the cache must degrade to thumbnails rather than broken images
- Substitution quality depends on correct pattern and muscle tags; a wrong tag produces an absurd swap in front of the user, so the rule needs unit tests on the full catalogue (every exercise must have at least one substitute in the default gym)
- Snap feature cost and abuse: an unauthenticated or unlimited endpoint turns a cents-a-month feature into a bill; require sign-in, per-user daily caps and a 1024 px image limit before it goes live
- Privacy of gym photos: other members and reflected faces in frame, GPS in EXIF, and the model provider's retention; strip on device, show the notice once, and never store scan photos unless the user attaches them
- Scope creep across the all-in-one brief: the machine guide, What next and offline images are the v1 core; snap, clips and shared settings should wait until the photo library and the substitution rule are proven in the gym
- Stale toolchain: the existing node_modules is a partial Create React App install without a package.json; building on it will fail in confusing ways, so start clean with Vite
