# Recomp: the plan

Working name: Recomp (change it any time). Repo: ri1wik/gym-tracker. Address: https://ri1wik.github.io/gym-tracker/

Status: DRAFT for discussion. Nothing is built, published or pushed until this plan is approved.

---

## 1. What we are building

An installable web app (a PWA) that opens on your phone like a native app and on your laptop with a sidebar. Everything lives in a cloud account, so phone and laptop always show the same data, and every friend who signs in gets a private account of their own. The app still works in a gym with no signal: it reads from a local copy and pushes changes the moment it is online again.

It is an all-in-one gym companion for body recomposition:

- A training engine that decides today's session, prefills every set from last time, generates the warm-up ramps, progresses loads, schedules deloads, and builds a session for any schedule you ask for ("chest and triceps, 45 minutes").
- A library of about 85 exercises with start and end illustrations, plus a machine guide with real photos of the machines at your gym, setup notes, your saved seat and pad settings, and a "what is this machine" search.
- A check-in every 4 days: weight, optional waist, front and side photos with a ghost overlay of your last photo, and a short read of the trend.
- A weekly review on a fixed day: up to three positives, three things that need attention, and one focus for next week, all computed from your own numbers.
- A food area built for Indian eating: dal, chicken breast, Isopure, Pintola, oats, eggs, fish, mutton, prawns, paneer, curd, roti and rice, with protein, calories, carbs, fats and fibre always visible and the full vitamin and mineral panel one tap away.
- Running and incline walking as first-class sessions with their own progression rules.
- Progress charts that answer the recomposition question honestly: trend weight beside strength, with photos as the tiebreaker.

Decisions already locked (from our discussion):

| Decision | Choice |
|---|---|
| Data | Cloud from day one; phone and laptop in sync; friends get their own accounts |
| Check-in | Every 4 days, with a photo set each time |
| Split | Push/pull/legs by default; upper/lower, full body and a minimal plan available, with a recommender |
| Automation | The app runs the program; any custom schedule gets a proper warm-up and working sets |
| Units | Kilograms and kilometres only |
| Gym | Anytime Fitness, full commercial equipment; machines get photos and setup notes |
| Food | Indian-specific catalogue; every food carries macros, fibre and the full micronutrient panel; fully editable |
| Hosting | Free: GitHub Pages for the app, Supabase free tier for accounts, data and photos |

---

## 2. The experience

Five tabs: Home, Train, Food, Progress, You. The active session takes over the full screen with the tab bar hidden.

**Home is one card.** "Next: Push A, last done Tuesday" with one Start button and one number: sessions this week, "2 of 6". On a check-in day the number slot reads "Check-in due". On review day it reads "Review ready". Nothing else above the fold.

**The three-tap loop.** Open the app, tap Start, tick set one. Every set is prefilled from the last time you did that exercise (load, reps, rest). Ticking a set starts the rest timer. This is the whole daily habit and it must take under 20 seconds in the gym.

**Active session.** One exercise card expanded at a time. Warm-up ramps sit above the working sets, greyed, with a "tick all ramps" button. Each working row shows "last: 60 kg x 8" and starts from that value. Plus and minus steppers in the exercise's own increment (2.5 kg barbell, the next dumbbell rung, one machine pin). Tap the number for a keypad. Completing a set pops the tick, starts the rest timer (computed from a stored end time, so it survives a locked screen), and scrolls the next row into view. The screen stays awake. Every tap is saved; relaunching the app lands you back in the session. A "Resume Push A, 23:14" pill sits above the tab bar on every other screen while a session is live.

**What next.** Finishing an exercise opens a sheet with the next prescribed exercise: its illustration, the machine photo, your saved seat and pad, target sets and reps, the load suggestion. Buttons: Go, "Busy, swap", Later. "Busy, swap" lists up to four substitutes (same muscle, same movement pattern, different equipment, only machines your gym has), each with a picture. One tap swaps it for today and the log records what you actually did.

**Confused at a machine.** A "What is this machine?" button on the session screen and in the library opens a photo grid, filtered to your gym, searchable by name, nickname or body part. Each machine shows its photo, what it trains, how to set it up, your saved settings, the exercises it supports, and a Start button.

**Finish.** A summary under five seconds: duration, sets, body parts worked, progressed / same / lower per exercise, PRs, and the "ready to add weight" hints for next time. Skippable.

**Check-in (every 4 days, about 2 minutes).** Weight with 0.1 kg steps, prefilled from last time. Waist at the navel every second check-in (optional). Front photo, then right side, with an on-screen pose guide and a ghost of your last photo at 35 percent so stance and distance match. Then a mini-read: change since last check-in, the trend line, "5 of 7 readings this cycle", the verdict once unlocked, and the date of the next check-in.

**Weekly review (fixed day, Sunday evening by default).** What you did, what moved, at most three positives and three attention items, one focus for next week, and the rows still "to unlock" with the exact count needed. One free-text line from you, quoted back next week. Share as text to the group chat in one tap.

**Food.** The header is the protein ring with grams remaining, calories remaining as the second number, and a chip for today's nutrient coverage. Favourites grid: tap a tile, tap confirm (two taps, last portion remembered). The micronutrient panel is one tap from the day summary and from any logged row, never on the logging path.

**Progress.** Trend weight (solid line, faded raw dots) with the most-trained lift's estimated 1RM as a second panel sharing the x axis; waist dots on the weight panel; sets per body part this week against the 10 to 20 band; weekly cardio minutes; per-exercise lift chart; the photo filmstrip with 4-week and 12-week compare.

**You.** Profile and targets, program and split, gym profile, units, theme, sync status, export, delete account.

**First run for a friend.** Sign in with Google, one-screen profile (sex, birth date, height, weight, activity, goal), pick a split from the recommender (or build your own in under a minute), join your gym profile or make their own. The install banner appears once, after the first finished workout, never before. One honest line at onboarding: strength shows in 3 to 4 weeks, the mirror in 8 to 12, the scale is not the scoreboard.

---

## 3. Training

### 3.1 Library and machines

- About 85 exercises across 11 body parts (chest, back, shoulders, biceps, triceps, forearms, quads, hamstrings, glutes, calves, core), each with a stable id, aliases (RDL, OHP, pulldown), equipment, movement pattern, primary and secondary muscles (secondaries capped at two), rep range, increment, rest, a one-line cue in original wording, a four-line how-to, three common mistakes, and start and end illustrations.
- 22 mapping muscles roll up to 14 scored groups and 11 browse body parts. A set contributes 1.0 to its primary muscle and 0.5 to a secondary, and at most 1.0 to any body part. This single contract is written and tested before the library ships, because the weekly volume gauge is only as honest as the map.
- Machines are their own catalogue (about 35 to 45 at Anytime Fitness): plain descriptive name ("plate-loaded iso-lateral row"), category, photo, muscles, setup checklist (seat, pad, grip, pin, foot plate), the exercises it supports, and nicknames people actually use. Each machine-based exercise points at its machine.
- Gym profile: which machines your gym has. Friends join your profile or make their own. Every suggestion surface (substitutions, swap lists, the library's "my gym only" toggle, program creation) reads it. Per-user saved settings per machine ("seat 4, pad 2") are the single most useful thing for a confused person at a machine.
- One original SVG body map (front and back, 14 regions) reused on exercise detail, machine detail, the session summary (today's heat) and the weekly volume view.

### 3.2 Images, legally

- Exercise illustrations: the RepDB free tier (609 exercises, original flat illustrations at 512 px, start and peak pose, 92 machine and cable movements), licence read in full and verified independently. Free for in-app use with one visible credit line, "Exercise data by RepDB (repdb.co)", in the About screen and README. Mapped to our 85 ids (79 match directly; the plate-loaded incline press, iso-row, machine high row and sled push need your own photo). Shipped in the repo as the original 512 px files plus a 256 px derivative, about 4 MB total, only the frames the app uses (never the whole set). Bookkeeping: pin the commit copied from, vendor the licence text beside the media manifest, delete the premium-samples folder, never feed the images to an image model. Machine photos ship at 800 px (a pin position must stay readable on a phone) with an optional lazy 1600 px set.
- Machine photos: taken by you at your gym in one quiet-hour visit, two frames per machine (the whole machine from the approach side, then the seat, pad and pin close-up), nobody else in frame, front desk asked once. Manufacturer product shots are copyrighted and out. Until a machine is photographed its card shows a placeholder and an "Add a photo" prompt, so the app ships before the photo session is complete.
- Not usable, verified: the widely copied "free exercise DB" photos are scraped from a commercial site (its own upstream says so, and the maintainer is discussing removing them); exercise GIF APIs forbid storing media and so cannot work offline; share-alike image sets carry per-image attribution and modification duties and 99 of them have no recorded author.
- A media manifest records source, licence and author for every shipped image. Later upgrade path: the paid RepDB tier gives looping animations with no attribution, same ids.

### 3.3 Programs and the recommender

All templates ship as data and every one targets recomposition. Switching split keeps all history, because history is keyed by exercise.

| Split | Suits | Weekly sets per major muscle | Session |
|---|---|---|---|
| Push/pull/legs, 6 days (default) | 5 to 6 days available, 1+ year training, 7+ hours sleep | 14 to 19 | 60 to 75 min |
| Push/pull/legs, 5-day rotation | 5 days, same templates rolled over the week | 13 to 16 | 60 to 75 min |
| Upper/lower, 4 days | 4 days, any training age, first year or short sleep | 11 to 14 | 60 to 70 min |
| Full body, 3 days | 3 days, beginners, deep deficit, poor sleep | 10 to 12 | 50 to 60 min |
| Minimal, 2 days | Travel, exams, maintenance | 6 to 8 by design | 45 min |

The recommender asks three things (days per week, minutes per session, one priority muscle or none) and reads training age, sleep and current deficit from the profile. First match wins: 30-minute sessions get full body; 2 days gets minimal; a beginner gets full body at 3 days or upper/lower at 4 or more; 6 days and 60+ minutes gets PPL 6-day; 5 days gets the PPL rotation; 4 gets upper/lower; 3 gets full body. Sleep under 6.5 hours steps the pick down one tier; a deficit above 20 percent caps at 5 days. A priority muscle does not change the split; it moves that muscle's session to the day after rest, puts its main lift first, and raises its target band so the volume guard adds 2 to 4 sets. The output names the reason and two alternatives.

### 3.4 The automation engine (one pure planner module)

One function takes (program state, history, gym profile, a session request) and returns a session plan: exercises, sets, rep ranges, loads in grams, rest, named warm-up ramps, and a one-line "why" per exercise. The rotation's next session and your "today I want chest and triceps in 45 minutes" are the same function with different inputs, so one set of test fixtures covers both. No randomness: identical inputs give identical plans.

- Next session: the next template after the last completed one, regardless of weekday. Rest days and skips never advance the pointer. An optional weekday pin ("Saturday is always Legs A") is on by default for fixed splits and off for PPL. A custom session advances the rotation only when it covers 70 percent or more of the template's primary-muscle sets.
- Load prescription (double progression): every set at the top of the rep range adds one increment (barbell 2.5 kg; squat, deadlift and hip thrust 5 kg above 80 kg; dumbbells move one rung of an editable ladder; machines one pin, default 5 kg). If the increment is more than 10 percent of the load (a 12.5 to 15 kg dumbbell jump), the app first raises the rep target by two, then jumps. Any set under the bottom of the range counts a failure; two in a row drop the load 10 percent, rounded to real plates; when the regression rounds back to the same load, the rep target drops instead, so nothing loops. Otherwise same load, one more rep on the first set that fell short.
- Equipment profile: bar types with their own floors (Olympic 20 kg, EZ bar 10 kg, fixed bars 10 to 50 kg), an editable dumbbell ladder, stack steps per exercise. Assisted exercises (assisted pull-ups, dips) carry assistance as its own positive number: progression removes one step of assistance, regression adds one, and they never enter the estimated-1RM or key-lift signals, so no percentage rule can ever make an assisted set harder by mistake.
- Deload: every 6th week (5th in a deficit of 20 percent or more), with a manual "deload now"; the key-lift regression trigger comes in 1.1. Half the sets, same loads, no progression attempts. One tap to skip or take early. Shown as a neutral row in the review, never a negative. A return after 10 or more days away is not a deload; it is the next session with loads minus 5 percent.
- Volume guard: projected weekly sets per group from the rotation. Under 10 suggests one add-on exercise placed where it fits; over 20 trims isolation sets first, compounds last. Shown as one banner with Apply, never auto-applied. Priority muscle band 14 to 22; minimal split band 6 to 12.
- Time-boxing (30, 45, 60, 75 or 90 minutes): cut the general warm-up 5 to 3 minutes, then rests (isolation 75 to 60 s, secondary compounds 150 to 120 s), then one set off each isolation (floor 2), then superset non-competing isolation pairs, then drop isolation from the end, then compounds to 3 sets. Compounds are never removed and ramps are never cut; if it still does not fit, the app says how many minutes it needs.
- Substitution when a machine is busy: candidates share the movement pattern and primary muscle; score +3 same equipment family, +2 per shared secondary, +1 has history, +1 not already done today; top three shown with pictures, filtered to your gym. The substitute's load comes from its own history, else the ratio table, else the ramp card. The same swap three sessions running prompts "make it the default?".
- Cardio placement: an incline walk row (15 to 20 min, 6 to 8 percent at 5 km/h by default; 10 to 12 percent only under the "hard" intent) appended after push or pull sessions; nothing hard after legs; never a hard run when the next session is legs; rest days get easy walks until the weekly target (default 150 min) is covered.
- Everything stays editable in place. The log records what you did, and history drives the next prescription, so an override is learned automatically. Learned rules: a repeated substitution, a repeated set-count change, a rest change, the general warm-up skipped twice, a one-tap "too easy" or "too hard" after a session.

### 3.5 Warm-up generator

General warm-up: 5 minutes incline walk (3 percent, 5 km/h) or bike, then two or three mobility drills keyed to the session's first pattern (push: band pull-aparts, scapular push-ups, dislocates; pull: dead hang, scapular pull-ups, cat-cow; squat: bodyweight squats, 90/90 hip switches, ankle rocks; hinge: glute bridges, dowel hinge, cat-cow).

Ramp sets from the prescribed first working load W, rounded to real plates:

| Case | Ramps |
|---|---|
| Barbell, W 60 kg or more | bar x10, 50% x5, 70% x3; then 85% x1 only when the working reps are 8 or fewer, and 92% x1 only for 5 or fewer |
| Barbell, 40 to 60 kg | bar x10, 60% x5, 80% x2 |
| Barbell under 40 kg | bar x8, 70% x3 |
| Dumbbell or machine compound | 50% x8, 75% x3 (one set at 50% x8 for light dumbbells) |
| Second compound of the same pattern in a session | one ramp at 70% x3 |
| First isolation for a muscle | one feel set at 60% x8; none for later ones |

Rest 45 s after the x10 and x5 ramps, 60 s after x3, x2 and singles. Any ramp that rounds to the same load as the previous ramp, or to the working load itself, is dropped. Examples the tests pin: bench 100 kg for 6 to 8 gives bar 20 x10, 50 x5, 70 x3, 85 x1; squat 140 kg for 5 gives 20 x10, 70 x5, 100 x3, 120 x1, 130 x1; bench 52.5 kg gives 20 x10, 32.5 x5, 42.5 x2; incline dumbbells 30 kg as the second push gives 20 x3; lateral raise 10 kg gives 6 x8. Warm-up rows are pre-created in the logger, labelled W, and excluded from volume, PRs, estimated 1RM, last-time prefill and the review.

### 3.6 Custom session builder ("any other schedule")

Inputs: focus (muscle groups in priority order, a pattern list, a template, or "any"), minutes, intent (normal, light, hard), exclusions, date. The planner expands the focus to patterns by a fixed table, fills slots one at a time until the time estimate would exceed the budget (so a 30-minute request gets one compound with 90 s rests plus two isolations, never a refusal; the count table of 3, 5, 6, 7 and 8 exercises for 30 to 90 minutes is a cap), takes each slot from your program first, then your history, then the library default for your gym, prescribes sets and reps (first compound 4 x 5-8 when hard or 3 x 6-10 normally, other compounds 3 x 8-12, isolation 3 x 10-15), loads by the prescription rules or the first-time estimate, generates warm-ups, runs the time-box trimmer, and warns when a muscle was trained in the last 48 hours or when a legs request sits next to the rotation's legs day. "Why" lines per slot: "Main chest press, first because it is the heaviest lift"; "Overhead extension for the long head that pushdowns miss".

First-time loads: from the Epley estimate of the related lift's best working set in its last session (reps clamped to 10), through a ratio table (incline barbell 0.80 x bench, OHP 0.60 x bench, front squat 0.80 x squat, RDL 0.70 x deadlift, barbell row 0.65 x bench, incline dumbbells per hand 0.30 x bench, and so on), times 0.90 for safety, rounded down to real plates; the result is used directly as the target's working load, with no reverse Epley step. The pinned fixture: bench 85 x 6 (Epley 102 kg) gives incline dumbbells 27.5 kg per hand. Machines and cables always get the ramp card instead: "work up to a set of 8 that feels like 2 reps left", stepping up while it feels easy; the first set at that effort becomes working set 1.

### 3.7 Cardio

- Three forms plus "other": outdoor run (distance, duration, run type, effort 1 to 10, optional heart rate), treadmill run (speed, incline, duration), incline walk (incline, speed, duration, effort, handrail flag). All prefilled from the last entry. Derived: pace, distance, vertical metres (5.5 km/h at 12 percent for 30 minutes is 330 m).
- Incline protocol card: entry level 6 percent at 4.5 km/h for 20 minutes; reference 12 percent at 4.8 km/h for 30 minutes, hands off the rails; one lever per week in this order: incline to 12, duration to 30 then 45, incline to 15, speed to 5.6, then a weighted vest rather than more speed.
- Running rules card: weekly kilometres rise at most 10 percent, every fourth week drops 30 percent, the long run is at most 30 percent of the week, one hard run a week, easy means full sentences; beginners start walk-run (1 minute run, 2 minutes walk) three times a week.
- Weekly target default 150 minutes in a 90 to 300 band, mostly easy, at most one hard session. Zone label from effort (easy 3 to 4, moderate 5 to 7, hard 8+).

---

## 4. Body: the 4-day check-in, photos and trend maths

- Due date = last check-in + 4 days, mornings, same conditions (after the toilet, before food, same scale). A calendar subscription (every 4 days at 07:00) is the reminder that works on phone and laptop without push notifications.
- Photos: front camera with a mirrored preview (so you can see yourself from 2 m away), un-mirrored on save so left and right stay true over time; rear camera only as an option when someone else shoots. Locked 3:4 portrait, pose guide, and your last photo of the same pose shown beside the shutter as the ghost in version 1 (a live overlay on the camera preview comes in 1.1 once the installed-app camera is proven on your phone). Resized on the phone to 1080 px long edge, JPEG 0.8 (150 to 350 KB), plus a 320 px thumbnail; the re-encode strips all metadata including GPS. Stored at one fixed path under your private folder (user id, then checkins, date, pose); nobody else can list or read it, and photos never appear in anything shared unless you tick the box. Lighting tips shown once: same room, same time, light in front, phone at chest height about 2 m away.
- Compare view: any two check-ins, defaulting to 28 days apart and 84 days apart, side by side first; slider and flip modes later. Filmstrip of all front photos with the weight under each.
- Trend maths: one point per reading; a robust slope (Theil-Sen on elapsed days) over the last 28 days gives the rate in percent of body weight per week; an exponentially weighted average with an 8-day half-life draws the line. Extra weigh-ins between check-ins count toward the trend (the photo cadence stays at 4 days), which roughly halves the wait for a verdict. A skipped check-in just delays the count.
- Verdicts only when the maths can back them: the slope's confidence interval is computed from the readings' own scatter, and a band verdict is issued only when that interval sits inside one band or wholly beyond the too-fast line. Until then the row reads "direction: down, not yet precise, 6 of 10". At a strict 4-day cadence expect 10 to 12 check-ins before a band verdict; with a few extra morning weigh-ins it comes in about 4 weeks. An early directional read appears after 4 readings spanning 12 days.
- Bands for recomposition: on track is losing 0.25 to 0.75 percent per week, and the 0.75 to 1.0 zone counts as the fast end of on track (the copy names the rate and says hold intake, with no positive tone); flat is within 0.25; too fast is beyond 1.0 for two check-ins running; the slow-down rule fires above 1.5 percent per week whatever the goal. No band verdict is issued before the full read of 7 readings over 24 days; the early read at 4 readings over 12 days gives a direction only. A band changes only when the rate crosses the edge by 0.05 points or stays across it for two check-ins, so the headline never flip-flops.
- The recomposition marker: flat scale with waist down 0.5 cm or more, or at least half of comparable lifts up, reads as a positive ("that is recomposition working, change nothing"). A flat week on a recomposition goal reads neutral for the first four flat weeks, never negative.
- The check-in and the weekly review stay separate: the check-in is a 2-minute data ritual with a mini-read of the trend; the review runs on a fixed weekday and reads the trend state alongside the weekly signals.

---

## 5. Food

### 5.1 The nutrient model

A fixed list of 29 nutrients on every food, stored per 100 g as integers: energy, protein, carbs, fat, fibre, sugar, saturated fat, vitamins A, C, D, E, K, B1, B2, B3, B5, B6, B9, B12, calcium, iron, magnesium, phosphorus, potassium, sodium, zinc, copper, manganese, selenium. Iodine has no reliable food source anywhere, so it is a separate estimated row credited from logged salt (Indian iodised salt at retail gives roughly 75 to 150 mcg per 5 g). Niacin is shown as niacin equivalents (preformed niacin plus tryptophan divided by 60), because a high-protein diet supplies much of its niacin through tryptophan and a bar built from preformed niacin alone would read low for exactly these users. Null means unknown and is never summed as zero; every day total carries the share of logged food that had a known value, so the panel can say "based on 82 percent of today's food". Each food carries a panel flag (full, partial, macros) and its source; expect a quarter of seeded rows to carry a few unknowns, printed on the row.

### 5.2 Where the numbers come from (licences checked)

- USDA FoodData Central, SR Legacy entries: public domain, full vitamin and mineral panels, 120 to 150 generic staples seeded into the repo by a one-time script (no live search function in version 1): dals raw and boiled (masoor, moong, toor, chana, rajma), chicken breast raw and roasted, whole eggs and whites, oats, rice, atta, milk, curd, natural peanut butter, prawns, goat meat, fish stand-ins, all with cooked twins where it matters.
- Labels: Isopure (per scoop), Pintola (per tablespoon), paneer, curd and soya chunks are typed from your own tubs and jars (Indian labels differ from the overseas entries). A label row can borrow its missing vitamins and minerals from a generic twin, copied unscaled and clearly marked "estimated from generic peanut butter"; pure whey gets no fill. This label form is the "customisable edits" requirement and covers any food the seed lacks.
- Open Food Facts barcode lookup comes in 1.1 through a small server function (browsers on iPhone cannot send the app identifier it requires), with the attribution line it requires. Live USDA search through the same function arrives when a friend's search misses twice.
- The Indian Food Composition Tables 2017 (ICMR-NIN) are the best source for Indian species and cultivars but the book forbids electronic storage for a product without written permission. They stay out of the app until NIN answers a permission email; until then Indian fish, buffalo milk and desi cultivars use the nearest generic entry, flagged as such.
- Indian home dishes are recipes, not lookups: moong dal tadka, rajma masala, chicken curry and roti ship as presets built from seeded ingredients with a cooked yield, so a katori of dal and a roti count map to real grams. Portion defaults: katori 150 g, roti 40 g from 30 g atta, scoop 31 g, tablespoon 16 g, whole egg 50 g, glass of milk 250 g, paneer piece 100 g, soya chunks 50 g dry; every portion carries a raw or cooked state so nothing double counts. You weigh each once so the defaults match your kitchen.

### 5.3 Catalogue and search

A shared catalogue in the backend (seeded plus user-added, deduplicated by source), per-user favourites, and food logs that snapshot the nutrients at log time so later edits never rewrite history. The catalogue is pulled into the phone's local copy through the same sync layer as everything else, so search is instant and works in the gym with no signal.

### 5.4 Targets and the daily panel

- Reference intakes: ICMR-NIN 2020 RDAs for Indian adults by sex, with a tick at the EAR; US DRI values for the few nutrients the NIN summary omits, labelled as such, and a switch to US DRI for any friend who prefers it.
- The primary number is the seven-day average, because a dal day and a chicken day differ by design. Nothing is judged until five of the last seven days are logged with coverage above 80 percent; before that the row reads "to unlock: log 5 days".
- Always visible: protein, calories, carbs, fat, fibre, plus iron, calcium, vitamin D and B12 (the typical gaps of a dal, roti, curd and chicken diet). Full 30-nutrient panel one tap away. Three neutral shades (covered, adequate, low), no red, no notifications.
- Calorie target from the profile (section 6), protein target 2.0 g per kg (adjustable 1.6 to 2.4) on a reference weight capped at BMI 30; fat floor 0.6 g per kg; fibre 14 g per 1000 kcal shown as a target.

### 5.5 Logging and the protein helper

Two taps for a favourite; new foods become favourites after the second use; "same as yesterday" and "repeat this meal" for the weekdays that repeat. The protein helper ranks your favourites and the seeded staples by protein per 100 kcal, keeps those whose portion fits the remaining calories, and shows the top three with the protein they add (egg whites, chicken breast, an Isopure scoop, soya chunks, low-fat curd, masoor dal usually lead). A fourth slot shows the option that also closes the day's weakest tracked micronutrient (paneer for calcium, rajma for iron, eggs for B12). Rules it applies: protein at every meal, 25 to 40 g per feeding, front-load breakfast, lean sources when calories are tight, a slow protein before bed.

Scope fence for the food area: no camera barcode scanning, photo food recognition, meal timing, restaurant database or AI portion guessing in version 1. Every food feature must feed a weekly review signal or it is cut.

---

## 6. The engine: targets, signals, guardrails

**Targets.** BMR by Mifflin-St Jeor; maintenance by an activity multiplier that includes training (sedentary 1.2, light 1.375, moderate 1.55, active 1.725); recomposition target is maintenance minus 15 percent (10 to 20 band; 5 to 10 for a lean or advanced lifter); lean gain plus 5 to 10. Always a suggestion you accept or override, never auto-applied. Worked example pinned as a test: male, 30, 178 cm, 80 kg, moderate activity gives BMR 1767.5, maintenance 2740, target 2329 before rounding, protein 160 g, expected loss 0.37 kg per week.

**Six weekly signals**, each returning positive, neutral, attention or "to unlock", with the number, one sentence and one action:

1. Weight trend (section 4 bands, recomposition marker, hysteresis).
2. Sessions done versus planned, this week and over four weeks. Speaks from week one.
3. Working sets per body part against 10 to 20, floor 8 in a deficit; warm-ups excluded; every working set counts whatever the reps.
4. Protein days hit (at or above 90 percent of target) out of days logged; names the meal slot with the biggest gap and a food from your own list that closes it.
5. Cardio minutes against target, with running kilometres and vertical metres as detail; flags a kilometre jump above 15 percent in a week.
6. Lifts progressed: share of exercises with a previous session that beat it (more load at the same reps, or more reps at the same load). Holding strength while losing weight reads as a positive: "that is the muscle you kept".

Micronutrients add at most one candidate for the focus, only when a tracked nutrient's seven-day average sits below the EAR with coverage above 80 percent, phrased as a food suggestion, never as a deficiency claim.

**Assembly.** At most three positives and three attention items in priority order (protein, sessions, weight trend, lifts, sets per body part, cardio), one focus taken from the top attention item, or "keep doing exactly this". "To unlock" rows list the exact count still needed and never sit under attention, so the week-one review already speaks through sessions, protein and lifts. The review is a pure function of the records in the window; it stores an inputs hash and recomputes when anything changes, so editing a past set never leaves a stale verdict beside a fresh chart.

**Guardrails, in the same tested module.** Calorie floor is the larger of BMR and 1200 kcal (female) or 1500 kcal (male); the deficit never exceeds 25 percent; the rate target never exceeds 1 percent per week; loss faster than 1.5 percent per week for two check-ins always reads "slow down"; logged intake under the floor on three or more days gets a logging check, never praise; banned phrases (burns fat, boosts metabolism, detox, cures, any condition name); no exclamation marks on attention items; every message names a number and ends in one action; a one-line disclaimer on the profile and the review (general fitness information, not medical advice; see a professional if pregnant, under 18, on medication that affects weight, or with a history of disordered eating). Female, prefer-not-to-say and lean-gain fixtures run beside yours so every formula branch is tested, not only your numbers.

---

## 7. Architecture

### 7.1 Stack

Vite, React 19, TypeScript, Tailwind v4, React Router (hash router, so GitHub Pages needs no redirect tricks), vite-plugin-pwa with an "update ready" prompt (never an automatic reload mid-workout), Dexie 4 on IndexedDB for the local copy, charts lazy-loaded on the Progress route only, Vitest on a pure domain module (targets, trend, estimated 1RM, sets per body part, the planner, the warm-up generator, the review rules, the nutrient maths) that imports no React and no database. System and self-hosted fonts only; nothing external on the first paint.

### 7.2 Backend: Supabase free tier, Mumbai region

Checked on 8 October 2026: 500 MB Postgres, 1 GB file storage, 5 GB egress, 50,000 monthly users, Google sign-in and custom SMTP included, no card. Firebase was rejected because its file storage now requires a pay-as-you-go plan with a card on file, which photos would force. Offline-sync products add a second learning curve and tighter caps for data this small.

- Sign-in: Google, redirect flow (popups fail inside installed apps), with the authorisation-code flow set explicitly (the client library's default puts tokens in the URL fragment, which a hash router would swallow; this exact bug is tested on Android Chrome, iPhone Safari and both installed apps before anything else is built, and a failure on the iPhone pulls the email code sign-in forward). "Choose account" is forced on every sign-in so a friend can switch accounts on a shared laptop. Email 6-digit code as the second method when a friend without Google appears (a magic link opens in the wrong browser on a phone). Optional allow-list so only invited emails can create accounts.
- Tables, all with id, user_id, created_at, updated_at, version, deleted_at: profiles, body_weights, photos, programs, workouts, workout_sets, cardio_sessions, machine_settings, gym_profiles, foods (shared catalogue), portions, favourites, recipes, food_logs. Row level security on every table and on the photo bucket: a user can only read and write rows and files with their own id. Migrations live in the repo so the schema is reproducible.
- Offline and sync: the app reads only from the local copy and never waits for the network on the Train screen. Every write goes to the local copy and into an outbox in one local transaction (so a phone killed mid-write can never hold a set the server will never see); the outbox flushes when online, when the app returns to the foreground, and right after a write, one flush at a time with a 15-second timeout so a hung request on gym Wi-Fi cannot block the queue. Row ids are client-generated, every push is an upsert, so a retry can never duplicate; rows keyed by date (weigh-ins, photos) derive their id from the date and the user, so phone and laptop recording the same day merge instead of colliding. Responses are classified: an expired token refreshes and retries, rate limits and server errors back off, and only a genuinely invalid row goes to a dead list shown item by item with Retry and Discard, never a bare count. The server keeps a version counter and timestamp through a trigger (clients never send them); last writer wins by server receipt order, at row level, except that "finished" and "deleted" are one-way (a finished session can never be un-finished by a stale copy). Sets are their own rows, so set 3 on the phone and set 1 on the laptop never collide; only profile and program settings are genuinely shared and change rarely. Pull per table since a cursor, merge by a pure tested function, soft deletes so deletions reach the other device. One generic sync routine written once; a new table is one line of config. The local database is named per user and wiped on sign-out, and the service worker never caches anything from the backend, so a friend signing in on your laptop sees nothing of yours. The install banner only appears after the first workout has synced, so an installed copy never opens empty.
- Live mirroring (laptop updating while the phone logs) is not in version 1; the laptop refreshes within a second of being focused.
- Photos: private bucket, path prefixed by user id, upload queued through the outbox so a check-in in a dead spot still completes; thumbnails cached locally for the offline compare view; full size through short-lived signed links. About 55 MB per user-year, so the 1 GB free tier is roughly 18 user-years before a paid plan (25 USD per month) or a retention rule (full size for 12 months, thumbnails forever).
- Keep-alive: free projects pause after a week without database activity (restorable for a year, data intact). Your own use is enough in normal weeks; for holidays a daily ping that writes one row runs from two independent places (GitHub Actions and a free external cron service), because GitHub disables scheduled workflows in a repo with no commits for 60 days. A pause costs one Resume click, never data.
- Delete account: the client removes the user's files, then a server function deletes the auth user and every table cascades. Export: a client-side zip of all tables as JSON plus the photos.
- Public repo hygiene: the project URL and the publishable key are safe to commit; the service key, database password, Google client secret, SMTP and USDA keys never are. No real body numbers in fixtures or seeds. Honest line for friends: the developer can see all data and photos through the dashboard.

### 7.3 Hosting

GitHub Pages from the public repo, deployed by GitHub Actions on every push to main (typecheck, tests, build, deploy). The base path /gym-tracker/ is permanent and shared by the build, the manifest and the service worker; dev runs at the same base so path bugs show on the desk, not the phone. The database name and every local storage key are prefixed because ri1wik.github.io already hosts two other sites. Every emitted chunk is precached; a chunk-load error offers a reload. A custom domain is a one-way door (installed copies would strand), so it is decided before the first friend installs.

### 7.4 Data safety on phones

With the cloud as the source of truth, a cleared browser or an evicted site no longer loses data; it re-syncs. The outbox flushes right after each write when online, so the exposure is a session logged entirely offline and then never reopened. The install banner (after the first finished workout) is still worth it for the home-screen icon, the camera, offline images and the wake lock. A link opened inside WhatsApp or Instagram lands in an in-app browser that cannot install; the first screen detects that and offers "Open in Safari or Chrome" with a copyable link.

---

## 8. Design system

Feel statement: a good stopwatch, not a spreadsheet. Instant, legible at arm's length, never in the way of the next set. Decision test for every screen: if a change adds a tap, a wait or a word between you and the next set, it is wrong.

- Dark first (not pure black), one accent for actions (ember orange), mint for success and PRs and positives, rose for attention items (the UI never says "negative" or "failed"). Light variant with the same semantic names. Chart colours validated for colour-vision deficiency.
- One variable font (Inter), tabular numerals on every number so columns and timers never jitter. Anything read mid-set is 22 px or larger at weight 700. Inputs never under 16 px (iOS zooms otherwise).
- Tap targets 44 px minimum, 48 preferred, 56 for set-row controls. Bottom sheets instead of dialogs. Undo toasts instead of "are you sure" modals. Every gesture has a button twin.
- Motion budget: every interaction responds under 100 ms; nothing animates between a tap and a logged set; the set-complete pop is 180 ms; no confetti, no count-ups, no splash, no onboarding carousel; reduced-motion respected.
- Laptop: above 1024 px the tab bar becomes a sidebar, content capped at about 1120 px, charts wider with hover tooltips, keyboard entry in the workout table (Tab, arrows, Enter) comes after the loop is proven on the phone.
- Performance: first load under 200 KB of JavaScript gzipped, offline from the second visit, zero layout shift (fixed aspect boxes for charts, reserved space for the rest dock).

A rendered draft of the tokens, Home, active session, weekly review and laptop dashboard already exists and was sent for your reaction before any component is written.

---

## 9. Retention rules (what keeps friends logging)

Twelve rules, in priority order, from the habit research pass and its critic:

1. The three-tap loop: one suggested session, one Start button, every set prefilled, tick per set, auto rest timer, wake lock.
2. Never lose a set: save every tap, resume pill on every screen, undo instead of confirm, edit any past set or weigh-in.
3. The routine is yours: swap, add, remove, rename, custom exercises, build-your-own in under a minute. The starter plan is a door, not the only door.
4. Durability made visible: cloud sync status, install banner once after the first finished workout, export always available.
5. Progress at the point of logging: "last: 60 kg x 8", a gold tick with a 400 ms inline PR badge (one per set), first-time records labelled on workout one, an estimated-1RM sparkline on each exercise page.
6. An honest review: built only from logged data, states its basis ("3 sessions, 2 check-ins"), a thin week gets a thin review, one free-text line quoted back next week, next week pre-chosen.
7. Share as text from day one through the share sheet; a picture card only after text shares have been posted in the group twice.
8. The recomposition chart: trend weight above, strength below, sharing one x axis; waist dots on the weight panel. Flat weight beside rising strength is the honest "yes, it is working".
9. Consistency in weeks only: you pick a weekly target, Home shows "2 of 6", Progress shows the last 12 weeks as chips (hit, partial, off). No daily streaks, no best-streak counters, no missed-day numbers anywhere.
10. A kind return path: quiet-week copy that names the next session and nothing else; "Welcome back. Start light?" after 14 days away with loads prefilled at minus 10 percent; a pause toggle for travel and illness.
11. Rest-day card shows the next planned session; protein appears only once favourites exist. Food logging is protein-first with calories and the panel one tap away.
12. The progression hint: after two sessions at the top of the range on every set, the next session is prefilled one increment higher with a "suggested" label and one-tap reject. That is the moment the app feels like a coach.

Anti-patterns banned by name: daily streaks that reset, XP, levels, badges, leaderboards, friend comparison views, confetti, motivational quotes, red marks, "you have not trained in 9 days", a dashboard home screen, an account wall before value (sign-in is required here, so the profile stays one screen and the first session is ready immediately), padding a thin week's review.

---

## 10. Milestones

Each milestone ends deployed and usable on your phone. A session is one focused sitting of 2 to 3 hours.

| # | Milestone | You get | Sessions |
|---|---|---|---|
| M0 | Scaffold, pipeline, cloud foundation | Live URL that installs on phone and laptop; Google sign-in works; database with security rules; keep-alive; the stray node_modules replaced | 2 |
| M1 | Sync layer, profile, first check-in | Local copy plus outbox plus pull, tested; profile with live targets; weight check-in (no photos yet) with the trend chart in "collecting" mode. Data collection starts here | 3 |
| M2 | Library, machines, programs | 85 exercises with illustrations; machine catalogue with your photos and setup notes; gym profile; the five splits and the recommender; rotation | 3 |
| M3 | The logger | Active session with prefill, steppers, warm-up rows, rest timer, wake lock, auto-save and resume, what-next and substitution, finish summary, PRs, double progression. Then two weeks of real gym use before anything new | 4 |
| M4 | Photos and the full check-in ritual | Camera with pose guide and ghost, resize, queued upload, private storage, compare view with 4-week and 12-week jumps | 2 |
| M5 | Food | Nutrient model, seeded staples, label entry, catalogue search, two-tap logging, protein ring, daily panel against ICMR-NIN targets, recipes with presets, protein helper | 4 |
| M6 | Cardio and planner extras | Run and incline forms with protocol cards, cardio placement, deload, volume guard, time-boxing, custom session builder | 2 |
| M7 | Weekly review, progress, friends | Rules document with test vectors first; the six-signal review; progress charts; text share; friend onboarding and gym-profile join; delete account; export | 3 |

Total: about 23 sessions to version 1. M0 to M3 (12 sessions) give you a cloud-synced gym tracker you use every training day; everything after that adds a layer you can already feel. Because the build runs with several agents in parallel (see BUILD-WORKFLOW.md), calendar time is set by your gym testing between milestones, not by typing.

Version 1.1, in this order, once version 1 is in daily use: scored busy-machine substitution replacing the manual swap picker; the volume guard with one-tap Apply; the protein helper and the micronutrient focus candidate; the recipe builder (version 1 ships the four presets as ready rows); override learning; the key-lift regression deload trigger; weekly intents ("legs twice this week"); the live camera overlay; waist every second check-in and the back pose; slider and flip photo compare and the picture share card; email code sign-in; Open Food Facts barcode lookup and live USDA search through a server function; IFCT values once NIN permits; client-side export of all data and photos; live laptop mirror; "snap the machine" (photo to a vision model, benchmarked for cost first); user-uploaded machine photos for other gyms; push reminders; the full laptop keyboard table; adaptive calorie rebasing; the 12-week running plan as a tick-off schedule; animated exercise demos (paid illustration tier).

---

## 11. What you need to do (one-time setup)

1. Create a free Supabase account and one project in the Mumbai region. Keep the database password in a password manager. Make sure the owner email is one you read (pause warnings arrive there).
2. In Google Cloud Console: a project, an OAuth consent screen (External, published, only openid, email and profile), and a Web client with the Supabase callback URL and ri1wik.github.io as the origin. Paste the client id and secret into Supabase.
3. Get a free USDA FoodData Central API key (email only, instant). It goes into Supabase as a function secret, never into the repo.
4. Email NIN (ifct2017@gmail.com and nin@ap.nic.in) asking for written permission to store IFCT 2017 values in a personal, non-commercial tracker shared with friends. Until a reply arrives, those values stay out.
5. One quiet-hour visit to Anytime Fitness: ask the front desk once, then photograph about 35 to 45 machines, two frames each, nobody else in frame. Also photograph the dumbbell rack and the cable stacks so the increment ladders are right.
6. Type the label values from your Isopure tub and Pintola jar; weigh one katori of dal, one roti, one scoop and one tablespoon once.
7. Give your last working sets for bench, squat, deadlift, overhead press and barbell row, or plan to do the ramp card on day one.
8. Pick: PPL 6-day with a fixed rest day (Sunday suggested) or the 5-day rotation; the review weekday; the check-in reminder time.
9. Take the first check-in in the spot and light you will reuse; it becomes the ghost for every later one.

No physique photos are needed by me or by the engine. The comparison is you against your own earlier photos, and nothing leaves your account.

---

## 12. Risks and how the plan handles them

- The sync layer is the riskiest slice; it is built and tested (merge as a pure function, outbox retries, dead-letter line) in M1 before anything depends on it.
- The logger decides whether the rest of the app ever gets data; M3 is followed by two weeks of your own gym use and fixes before new features.
- The muscle map decides whether the volume gauge is honest; one written contract and a fixture that runs every template through it, before the library ships.
- Band edges and scale noise are the main way users lose trust; no verdict before 7 readings over 24 days, robust slope, hysteresis, and flat recomposition weeks read neutral.
- Wrong advice is real-world harm; floors, the deficit cap, the slow-down rule, banned phrases and the disclaimer live in one tested module, with female and lean-gain fixtures.
- Null micronutrients summed as zero would report false lows; the coverage line and the 80 percent gate are the guard.
- Image rights: only RepDB illustrations with the credit line and your own machine photos; a manifest records every file's source; a release check refuses anything else.
- Free-tier walls: 1 GB of photos arrives in year two with ten friends; a retention rule or 25 USD per month is the answer, decided then, not now.
- Public repo: synthetic fixtures only, no personal numbers, no secrets, and a grep of the tree and the commit log before every push.
- Two rhythms (4-day check-in, weekly review) could feel like two nags; Home shows one prompt at a time and the review has a fixed day.

---

## 13. Open questions (only ones that change the build)

1. Program name and app name: keep "Recomp" and the repo name gym-tracker, or something else? The address is a one-way door once friends install.
2. Review day and time: Sunday evening?
3. PPL 6-day with Sunday off, or the 5-day rotation?
