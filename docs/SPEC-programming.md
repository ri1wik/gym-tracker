# Automated programming, warm-ups and the 4-day check-in

Reference material for builders. PLAN.md wins on any conflict.

## Recommendation

Ship push/pull/legs 6-day as the default program on top of one deterministic planner: a pure TypeScript module that takes (program state, history, equipment profile, a SessionRequest) and returns a SessionPlan with exercises, sets, rep ranges, loads in grams, rest, named warm-up ramps and a one-line why per exercise. The rotation's next session and the user's "today I want chest and triceps in 45 minutes" are the same function with different inputs, so one set of Vitest fixtures covers both. Prescribe loads by double progression from the last working sets with equipment-aware rounding (2.5 kg barbell, dumbbell ladder, stack steps), compute ramps from the prescribed first working load, and deload every 6th week (5th in a deficit above 20 percent) or when two key lifts regress for 3 weeks. Keep the check-in every 4 days as a 2-minute data ritual (weight, optional waist every second check-in, front and side photo with a ghost overlay) and run the weekly review on a fixed weekday reading the trend state; re-parameterise the trend gate for the cadence: early read at 4 readings spanning 12 days, full verdict at 7 readings spanning 24 days, hysteresis measured in check-ins (two runs = 8 days).

## Split catalogue (all templates ship as data, every one targets recomposition)

- PPL 6-day (Push A, Pull A, Legs A, Push B, Pull B, Legs B, rest): suits 5 to 6 days available, training age 1 year or more, sleep 7 h or more. Delivers per week about chest 18, lats 14, upper back 19, front delt 13, side delt 11, rear delt 12, biceps 18, triceps 16, quads 16, hamstrings 11 to 12, glutes 11, calves 8, abs 6. Session 60 to 75 min.
- PPL 5-day rotation (the same 6 templates rolled over 5 training days, so week 1 is P P L P P, week 2 is L P P L P): suits 5 days, same training age, better recovery margin. Each muscle 1.67 times per week; weekly sets about 5/6 of the 6-day numbers (chest 15, upper back 16, quads 13, hamstrings 10). The volume guard adds one lateral raise set and one hip thrust set to keep side delts and glutes at 10 or above. Session 60 to 75 min.
- Upper/Lower 4-day (U1 L1 U2 L2, Mon Tue Thu Fri default): suits 4 days, any training age, the right pick for a first year of training or sleep under 7 h. Upper: bench 4 x 6-8, barbell row 4 x 6-10, OHP 3 x 8-12 (U1) or incline DB 3 x 8-12 (U2), lat pulldown 3 x 8-12, lateral raise 4 x 12-15, curl 2, triceps 2. Lower: squat 4 x 5-8, RDL 3 x 8-10, leg press (L1) or Bulgarian split squat (L2) 3 x 8-12, leg curl 3, calves 4, abs 3. Weekly about chest 14, upper back 14, lats 11, quads 14, hamstrings 12, glutes 10, side delt 11, biceps 11, triceps 11. Session 60 to 70 min.
- Full body 3-day (A B C, Mon Wed Fri): suits 3 days, beginners under 1 year, anyone in a deficit above 20 percent or with poor sleep. Each session: one squat or hinge, one horizontal push, one pull, one secondary lower, one isolation pair. Weekly about 10 to 12 for each major muscle, 9 to 11 for side delts, 6 for arms direct. Session 50 to 60 min.
- Minimal 2-day (two full body sessions, 72 h apart): travel weeks, exam weeks, maintenance. 6 to 8 weekly sets per major muscle by design, so while it is active the review's sets-per-body-part band becomes 6 to 12 and the volume guard is silent. Session 45 min.
- Bands: 10 to 20 weekly sets for the scored groups, abs and calves 6 to 12, forearms unscored. Priority muscle moves its band to 14 to 22.

## Which-split recommender (one screen, three questions)

- Inputs: days per week (2 to 6), minutes per session (30, 45, 60, 75, 90), priority muscle (none or one of the 14 groups). Training age (beginner under 1 year, intermediate 1 to 3, advanced 3 plus), sleep hours and the current deficit come from the profile.
- Rule, applied top down, first match wins: minutes 30 at any days -> full body 3-day (or minimal if days is 2); days 2 or fewer -> minimal; beginner -> full body 3 if days is 3, upper/lower if days 4 or more; days 6 and minutes 60 or more -> PPL 6-day; days 5 -> PPL 5-day rotation; days 4 -> upper/lower; days 3 -> full body 3-day (advanced with 75 min or more also sees PPL once-through as an alternative).
- Step-down modifiers: sleep under 6.5 h or self-reported poor recovery steps the pick down one tier (PPL 6 -> PPL 5 -> UL 4 -> FB 3); deficit above 20 percent caps at 5 days.
- Priority muscle does not change the split; it orders that muscle's session first after the rest day, puts its main exercise first in that session, and raises its band to 14 to 22 so the volume guard adds 2 to 4 sets (placed per the guard's placement rule). The reason string names it: 'PPL 5-day: you have 5 days and 60 minutes; side delts get a lateral raise set on pull days too'.
- Output: { split, reason, alternatives: [two next-best with one-line trade-offs] }. Switching split keeps all history because history is keyed by exercise, not by template.

## Rotation and next session

- Program state: templates[] in order, pointer = index of the last completed template. nextSession = pin[todayWeekday] ?? templates[(pointer + 1) mod n]. Rest days and skipped days never advance the pointer; a 10-day gap just resumes at the next template with a 'first session back: loads minus 5 percent' note.
- Weekday pin is optional: a map weekday -> template (for example Saturday -> Legs A). When today's weekday is pinned, the pinned template is offered and the pointer is set to it afterwards, so the rotation continues from there. Pins are the default on fixed splits (UL and FB) and off on PPL.
- A completed custom session advances the pointer only if its sets cover 70 percent or more of the template's primary-muscle sets; otherwise the rotation stands ('Push is still next').

## Load prescription and double progression

- Inputs per exercise: repRange [lo, hi], sets N, equipment profile. History = the last completed working sets of the same exercise id (warm-ups excluded). Loads are integers in grams; display in kg.
- Increment per equipment: barbell 2500 g (1.25 kg plates each side), squat, deadlift and hip thrust 5000 g once the load is 80 kg or more; dumbbell: next rung of the editable ladder (default 1, 2, 3, 4, 5, 6, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50 kg per hand); machine and cable: stack step, default 5 kg, editable per exercise; weighted bodyweight: 2.5 kg steps from 0; assisted: negative allowed.
- Rule: all sets at or above hi -> load + increment. If increment / load > 0.10 (dumbbell 12.5 -> 15 is 20 percent) keep the load and raise the rep target to hi + 2 first, then jump. Any set below lo -> failure counter for that exercise at that load + 1; at 2 consecutive failures -> load x 0.90 rounded to the nearest equipment step, counter reset. Otherwise same load, target = last reps + 1 on the first set that was below hi.
- Rounding function roundToEquipment(grams, equipment, direction): barbell nearest 2500 (never below the empty bar), dumbbell nearest rung (lower on a tie), machine nearest step. Progressions round nearest, regressions round nearest, first-time estimates round down.
- Key lifts for the deload and review signals: the first compound of each template (bench, barbell row or pull-up, squat, OHP, deadlift or RDL). e1RM by Epley on the best working set of the week.

## Deload

- Trigger A: week index since program start or last deload reaches deloadEvery (6 default; 5 for advanced or while the deficit is 20 percent or more). Trigger B: two or more key lifts show a lower best weekly e1RM than the week before for 3 consecutive weeks. Trigger C (offered, not forced): sessions done under 50 percent of planned for 2 weeks.
- Deload prescription: sets = ceil(N / 2), same loads, target reps = lo, no progression attempts, no failure counting, warm-ups unchanged, rotation continues. Counters and the week index reset after it.
- One tap to skip or to take it early; the review shows 'deload week' as a neutral row, never a negative.

## Auto-substitution when equipment is busy

- Library tags needed: pattern (horizontal push, incline push, vertical push, horizontal pull, vertical pull, squat, hinge, lunge, hip thrust, knee flexion, knee extension, calf, elbow flexion, elbow extension, lateral raise, rear delt, trunk flexion, anti-extension, pullover, fly), equipment family (barbell, dumbbell, cable, machine, smith, bodyweight), primary and secondary muscles.
- Busy button on an exercise: candidates must share the pattern and the primary muscle. Score: +3 same equipment family, +2 per shared secondary muscle (cap 2), +1 has history, +1 not already in today's session; ties broken by exercise id. Show the top 3.
- The substitute's load comes from its own history, else the ratio table, else the ramp-to-RPE card. The log records the exercise actually done (volume credits it); the original keeps its history untouched. The same swap three times running prompts 'make it the default in Push A?'.

## Volume guard

- Projected weekly sets per group = sum over the rotation's templates of (sets x contribution) x sessionsPerWeek / templatesInRotation; contribution 1.0 primary, 0.5 secondary, capped at 1.0 per set per body part (round 1 rule). Reruns after every template edit and after every custom session.
- Under 10: suggest one add-on exercise (library default for that muscle's first pattern, 3 sets) placed in the session with the shortest estimate where the muscle is not already near the cap, and never the day before that muscle's main session. Over 20: trim one set at a time from isolation exercises for that muscle starting at the end of the session, floor 2 sets per exercise; compounds lose a set only when every isolation for that muscle is at 2.
- Shown as one banner line on the Program screen with Apply; never auto-applied. Priority muscle band 14 to 22; minimal split band 6 to 12.

## Cardio placement (target 150 min per week, editable)

- After push or pull sessions: append 'incline walk 15 to 20 min, 10 to 12 percent, 5 to 6 km/h' as the last row of the session. After legs: none or a 10 min flat cool-down.
- Never a hard run (intervals or zone 4 plus) when the next template in the rotation is a legs day; rest days before legs get an easy walk or bike only. Rest days elsewhere: 30 to 40 min walk or bike, assigned until the weekly remainder to 150 min is covered.
- Logged as minutes and optional km; counted in the review's cardio signal.

## Time-boxing (budget 30, 45, 60, 75 or 90 min)

- Estimate = general warm-up + per exercise (ramps: reps x 3 s + ramp rest; sets x (set time 40 s, 45 s for compounds, + rest); transition 90 s). Default rest: first compound 150 s (squat and deadlift 180 s), other compounds 150 s, isolation 75 s.
- Trimming order, stop as soon as the estimate fits: 1 general warm-up 5 -> 3 min; 2 rest cuts (isolation 75 -> 60 s, secondary compounds 150 -> 120 s, first compound untouched); 3 one set off each isolation (floor 2); 4 superset non-competing isolation pairs (biceps with triceps, lateral raise with rear delt, calves with abs) sharing one rest; 5 drop isolation exercises from the end of the session; 6 compound sets to 3 (floor 3); 7 if still over, return needsMinutes and let the user pick what to drop. Compounds are never removed and ramps are never cut.

## Warm-up generator

- General: 5 min incline walk (3 percent, 5 km/h) or bike, then 2 or 3 mobility drills keyed to the session's first pattern: push -> band pull-aparts x15, scapular push-ups x10, band dislocates x10; pull -> dead hang 2 x 20 s, scapular pull-ups x8, cat-cow x8; squat -> bodyweight squats x10, 90/90 hip switches x6 per side, ankle rocks x10 per side; hinge -> glute bridges x12, dowel hinge x10, cat-cow x8; vertical push -> pull-aparts x15, wall slides x10, dislocates x10.
- Ramps from the prescribed first working load W (after progression, in grams). Barbell, W 60 kg or more: empty bar x10, 50 percent x5, 70 percent x3, 85 percent x1, plus 92 percent x1 when W is 140 kg or more. Barbell 40 to 60 kg: bar x10, 60 percent x5, 80 percent x2. Barbell under 40: bar x8, 70 percent x3. Dumbbell or machine compound: 50 percent x8, 75 percent x3; one set at 50 percent x8 when the dumbbell is 12.5 kg per hand or less. Second compound of the same pattern family in a session (incline DB after bench): one ramp at 70 percent x3. Compound of a different family (row after bench on upper day): its own full ramps. Isolation: one feel set 60 percent x8 for the first isolation of a muscle, none for later ones.
- Rounding: percentages computed in grams then roundToEquipment (bar never below 20 kg, dumbbell nearest rung, machine nearest step). Rest: 45 s after the x10 and x5 ramps, 60 s after x3, x2 and singles, then the exercise's working rest before set 1.
- Example: bench 100 kg -> Bar 20 x10, 50 x5, 70 x3, 85 x1. Squat 140 kg -> 20 x10, 70 x5, 100 x3, 120 x1, 130 x1 (92 percent = 128.8 -> 130). Bench 52.5 kg -> 20 x10, 32.5 x5 (31.5 -> 32.5), 42.5 x2 (42 -> 42.5). Incline DB 30 kg as second push -> 20 x3 (21 -> 20). Lateral raise 10 kg -> 6 x8.

## Warm-ups in the logger

- Pre-created rows above the working sets, labelled W, greyed, prefilled with load and reps, isWarmup = true in the stored set. One 'tick all ramps' button plus individual ticks; the rest timer runs at the ramp rest after each tick. Collapsible once ticked.
- Excluded from volume counts, sets-per-body-part, PR detection, e1RM, last-time prefill and the review. Stored in the session log so resume shows them. Long press converts a warm-up row to a working set (for ramp-to-RPE day one).

## Working set guidance for a custom schedule (same planner, different inputs)

- SessionRequest: { focus: muscle groups in priority order | pattern list | template id | 'any'; minutes; intent: normal | light | hard; exclude: exercise ids or equipment families; date }. Context read by the planner: rotation state, last 48 h of logged primary muscles, equipment profile, history. No randomness, so identical inputs give identical plans.
- Rules: 1 expand focus to patterns by a fixed table (chest -> horizontal push, incline push, fly; triceps -> overhead extension, pushdown; back -> horizontal pull, vertical pull, pullover; quads -> squat, lunge, knee extension; hamstrings -> hinge, knee flexion; side delts -> lateral raise; and so on), interleaving multiple muscles in the order given. 2 exercise count by minutes: 30 -> 3, 45 -> 5, 60 -> 6, 75 -> 7, 90 -> 8; compounds = min(3, floor(minutes / 15)), the rest isolation. 3 pick per slot: the exercise in the current program for that pattern, else the one with the most history, else the library default for Anytime Fitness (barbell first); apply exclusions; at most 2 isolation per muscle. 4 sets and reps: compound 1 is 4 x 5-8 (hard) or 3 x 6-10 (normal), compound 2 and 3 are 3 x 8-12, isolation 3 x 10-15; light intent uses RPE 7 targets and no progression. 5 loads by the prescription rules or first-time estimation. 6 run the time-box trimmer. 7 fatigue guard: a muscle trained as primary in the last 48 h is demoted to secondary with a note; a legs request the day before the rotation's legs session warns and offers to shift the rotation.
- Weekly intents such as 'legs twice this week' duplicate the requested template into the remaining slots of the current week, cut its sets by 25 percent when the two occurrences are under 72 h apart, rerun the volume guard and show 'quads 16 -> 23, trim applied'.
- Why lines are templated per slot: 'Main chest press, first because it is the heaviest lift'; 'Incline angle for the upper chest the flat press misses'; 'Isolation to bring triceps to 14 sets this week'; 'Overhead extension for the long head that pushdowns miss'. Output SessionPlan: exercises[{ id, slot, sets, repRange, targetLoadG, loadSource: history | ratio | ramp, restS, warmups[], why }], estimatedMinutes, rotationEffect, warnings[].

## First-time load estimation

- Ratio table against a known lift's e1RM, then reverse Epley to the set's target reps plus 2 in reserve, times 0.90 safety, rounded down to equipment. Chest: incline barbell 0.80 x bench, close-grip 0.85 x bench, flat dumbbell per hand 0.35 x bench, incline dumbbell per hand 0.30 x bench, OHP 0.60 x bench, dumbbell shoulder press per hand 0.22 x bench. Legs: front squat 0.80 x squat, hip thrust 1.0 x squat, Bulgarian split squat per hand 0.20 x squat, RDL 0.70 x deadlift. Back: barbell row 0.65 x bench, dumbbell row per hand 0.35 x bench. Arms: barbell curl 0.30 x bench, dumbbell curl per hand 0.12 x bench. Confidence medium for barbell and dumbbell targets; machines and cables are always low confidence and go to the ramp protocol.
- Ramp-to-RPE card (no reference or low confidence): 'Work up to a set of 8 that feels like 2 reps left'. Start at the floor (empty bar, 10 kg dumbbells, 2 pins), do 5 reps per step, step up 20 percent on a barbell or one rung or pin otherwise while it feels easy; the first set of 8 at RPE 8 is logged as working set 1, then 2 more sets at that load. An RPE picker (6 to 10) appears only on this protocol. From the next session the normal rules take over and ratios are never used again for that exercise.
- Example: bench 85 x 6 -> e1RM 102 -> incline dumbbell per hand 0.30 x 102 x 0.90 = 27.5 -> rung 27.5 kg; seated machine chest press -> ramp card.

## Check-in every 4 days with photo (the ritual, about 2 minutes)

- Due = last check-in date + 4 days, morning. On a check-in day the Home card's number slot reads 'Check-in due' until done, then returns to the usual number (Home stays one card). Free reminder that works on both devices without push: a subscribable .ics with FREQ=DAILY;INTERVAL=4 at 07:00; web push can come later.
- Step 1 weight in kg, 0.1 steps, prefilled with the last reading, with a 'same conditions' toggle (morning, after toilet, before food). Step 2 waist at the navel, optional, asked every second check-in (8 days), stored in mm. Step 3 photos: front then right side, back optional; the camera preview shows an SVG pose guide (feet marks, arms relaxed at the sides) and a ghost of the last photo of the same pose at 35 percent opacity so distance and stance match; 3-second timer; locked 3:4 portrait crop; rear camera preferred. Client-side resize to 1080 px long edge, JPEG 0.8 (150 to 250 KB), EXIF stripped, plus a 240 px thumbnail; stored under the user's private path checkins/{date}/{pose}. Step 4 mini-review: delta vs last check-in, the trend line, 'n of 7 readings this cycle', the verdict line once unlocked, the next check-in date, and the volume guard's banner if any. Missing data shows as 'to unlock', never a negative.
- Lighting tips shown once and on request: same room, same time, light in front not behind, phone at chest height about 2 m away, no mirror selfie. Weight alone counts for the trend; a check-in is complete only with both poses. Camera via getUserMedia in the installed PWA, falling back to a file input with capture where it is blocked (the ghost then sits beside the shutter instead of over the preview).

## Trend maths at the 4-day cadence and the weekly review

- About 7 readings per 28 days, so round 1's gate of 6 readings over 14 days cannot be met; make the gate a cadence parameter: daily weighers keep 6 readings over 14 days; the 4-day cadence unlocks an early read at 4 readings spanning at least 12 days (label 'early', flat band widened to 0.35 percent per week) and the full verdict at 7 readings spanning at least 24 days. Theil-Sen on elapsed days handles a skipped check-in; the time-aware EWMA uses a half-life of 8 days so each 4-day reading carries about 29 percent weight.
- Hysteresis in runs: 'two runs' means two consecutive check-ins (8 days). Bands unchanged: on track minus 0.25 to minus 0.75 percent per week, flat within 0.25, too fast beyond 1.0 for two runs; the slow-down rule above 1.5 percent per week fires at the first full-verdict reading that shows it.
- Keep check-in and review separate, with reasons: the review's signals (sessions vs planned, sets per body part, protein days, cardio minutes, 4-week e1RM) are weekly by nature and would be partial and noisy in a 4-day window; the trend is a continuous state the review simply reads; check-ins drift across weekdays while the review stays on a fixed day (Sunday evening default), which is the rhythm friends will follow; a merged 4-day review would give 1.75 reviews a week and double-count signals. The mini-review after a check-in is deliberately limited to the weight trend and the next session. The review adds 'photos: 4-week compare ready' as a positive at 28 days and a 12-week compare at 84 days.

## Photo comparison view

- Pick any two check-ins; defaults latest vs the check-in nearest 28 days earlier, and latest vs 84 days earlier; jump chips: 4 weeks, 12 weeks, start. Modes: side by side (same pose, same crop, no zoom), slider (top image clipped with clip-path inset and a draggable handle that works with touch), and flip (tap to toggle, best for subtle change). Filmstrip of all front photos with the weight under each.
- Share card rendered client-side to canvas with dates, weeks elapsed and weight delta; photos are included only when the user ticks the box. Photos are private to the account by storage rules and never reach a friend's view.

## What stays manual, and what the app learns from overrides

- Every prescription is editable in place: load, reps, sets, rest, exercise, order, the whole session, the split. The log records what was done and history drives the next prescription, so a load override is learned automatically.
- Learned rules: the same substitution 3 sessions running -> offer to make it the template default; a set-count override 2 sessions running -> the template adopts it; a rest change -> per-exercise rest preference; the general warm-up skipped twice -> offer the 3 min version; a one-tap 'too easy' or 'too hard' on a finished session -> next prescription shifts one increment or one rep target; a dumbbell rung marked 'my gym lacks this' -> removed from the ladder; deload skipped or taken early -> counters follow the user's choice.

## Tests (Vitest fixtures on the pure planner module)

- PPL 6-day through the volume projector: asserts the exact integer table printed in the catalogue (chest 18, lats 14, upper back 19, front delt 13, side delt 11, rear delt 12, biceps 18, triceps 16, quads 16, hamstrings 11, glutes 11, calves 8, abs 6) and no guard suggestions; removing the lateral raise from Push B must produce exactly one add-on suggestion naming a lateral raise placed in Pull A.
- Warm-ups: bench 100 kg -> [Bar 20 x10, 50 x5, 70 x3, 85 x1] with rests [45, 45, 60, 60]; squat 140 -> five ramps ending 130 x1; bench 52.5 -> [20 x10, 32.5 x5, 42.5 x2]; incline DB 30 as second push -> [20 x3]; lateral raise 10 -> [6 x8]; a logged bench with 4 warm-up rows and 3 working rows counts 3 chest sets and the 85 percent single is never a PR.
- Substitution for a busy seated cable row with no history: top candidate is the single-arm cable row (same pattern, primary, family), the full ordering of the top 3 is pinned by score then id; with history on the chest-supported machine row it moves to second.
- Progression: 3 x 80 kg at [8, 8, 8] in 6-8 -> 82.5; [8, 7, 6] -> 80 with target 8 on set 2; [5, 5, 4] twice -> 72.5; dumbbell 12.5 at hi -> stays 12.5 with target hi + 2, then 15; machine 60 kg with a 5 kg step -> 65.
- Rotation: last completed Pull A on a Thursday -> Legs A; pin Saturday = Legs A after a completed Push A on Saturday -> Legs A, then Push B next. A custom chest-and-triceps session covering 62 percent of Push primaries does not advance the pointer.
- Deload: week index 6 -> deload flag; two key lifts with 3 weekly e1RM declines at week 4 -> deload flag; the deload plan halves sets and keeps loads.
- Time-box: Push A at 45 min -> the trimmer applies steps 1 to 6 in order and returns bench 3 x 6-8, DB shoulder press 3 x 8-12, incline DB 3 x 8-12, lateral raise 3 x 12-15 supersetted with pushdown 2 x 12-15, estimate 45 or under; at 30 min it returns needsMinutes.
- Custom session 'chest and triceps, 45 minutes, normal': a pinned 5-exercise plan with why lines, loadSource per exercise (history, ratio, ramp), and the fatigue warning when chest was primary yesterday.
- First-time: bench 85 x 6 -> incline DB 27.5 kg per hand; machine chest press -> ramp card; a dumbbell ratio landing between rungs rounds down.
- Cardio: Legs next in rotation -> no hard run offered today; after Push -> incline walk row appended.
- Trend at the cadence: weights 82.0, 81.8, 81.6, 81.5 on days 0, 4, 8, 12 -> early verdict available; adding 81.2, 81.1, 80.9 on days 16, 20, 24 -> full verdict at minus 0.34 percent per week, on track; skipping day 16 and reading on day 28 instead still reaches the full verdict at the 7th reading.

## Build effort (evening sessions of 2 to 3 hours)

- Library tags (pattern, equipment family, ratio table, defaults): 1 session.
- Program model, five split templates, rotation with pin, recommender screen: 2 sessions.
- Load prescription, rounding, double progression, regression, fixtures: 2 sessions.
- Warm-up generator and logger rows: 1.5 sessions.
- Deload, volume guard, time-box trimmer with fixtures: 2 sessions.
- Substitution, custom session generator, why lines, fixtures: 2.5 sessions.
- Cardio placement: 0.5 session.
- Check-in ritual (weight, waist, camera with pose guide and ghost, resize, upload, thumbnails): 2 sessions.
- Photo compare (side by side, slider, flip, jumps, filmstrip) and share card: 1.5 sessions.
- Cadence parameters, mini-review, weekly review wiring, .ics reminder: 1 session.
- Override learning rules: 1 session. Total about 17 sessions for this lens; the must-have subset below is about 11.

## Must have

- One pure planner module (SessionRequest -> SessionPlan) with Vitest fixtures, serving both the rotation's next session and custom requests
- PPL 6-day templates as the default, plus the four other splits as data and the three-question recommender
- Rotation pointer with optional weekday pin; a custom session advances it only at 70 percent coverage
- Double progression with equipment-aware rounding (2.5 kg barbell, editable dumbbell ladder, stack steps), the big-step rep rule and the two-failure 10 percent regression
- Warm-up generator: general warm-up with pattern-matched mobility, ramp sets from the prescribed first working load, rounded to real plates, pre-created in the logger and excluded from volume and PRs
- Custom session builder with time-boxing (isolation trimmed first, compounds never dropped) and one-line why per exercise
- First-time loads from the ratio table with the 0.90 safety factor, ramp-to-RPE card for machines and cables
- Deload every 6th week (5th in a deficit of 20 percent or more) or on two key lifts regressing 3 weeks, half the sets at the same loads
- Check-in every 4 days: weight, front and side photo with pose guide and ghost overlay, client-side resize, private storage, mini-review
- Trend gate re-parameterised for the cadence (early at 4 readings over 12 days, full at 7 over 24), hysteresis in check-ins, weekly review on a fixed weekday reading the trend
- Photo compare side by side with 4-week and 12-week jumps
- Busy-equipment substitution ranked by pattern, primary muscle and equipment family

## Later

- Slider and flip compare modes, filmstrip, share card with photos
- Volume guard add-on and trim suggestions beyond the banner (one-tap Apply into templates)
- Cardio placement rules beyond the incline walk row (weekly remainder assignment to rest days)
- Override learning beyond loads: template adoption of set counts and substitutions, too easy or too hard taps, ladder edits
- Weekly intents such as legs twice this week
- Waist every second check-in and the back pose
- Web push reminders (needs a server); the .ics subscription covers it first
- PPL once-through for advanced 3-day users and a deload taken early from the review

## Risks

- Round 1's trend gate (6 readings over 14 days) is impossible at a 4-day cadence; the cadence parameter above replaces it and must be agreed before the review engine is coded
- Camera inside an installed PWA on iOS is workable but has quirks; the file-input fallback loses the live ghost overlay, so test the ritual on the user's phone in week one
- Dumbbell ladders and stack steps differ by branch; wrong defaults produce wrong rounding until the user edits the equipment profile
- Ratio estimates can miss by 20 percent; the 0.90 factor and the RPE check limit the downside but a first session may still feel light or heavy
- Secondary contributions at 0.5 can over-credit volume for small muscles; the per-set cap limits it but the printed table depends on the library's tags
- A custom legs session next to the rotation's legs day can overreach; the 48 h fatigue guard warns but does not block
- Deload only every 5th or 6th week may be too infrequent for an advanced lifter in a deficit; the regression trigger is the safety net
- Two rhythms (4-day check-in, 7-day review) can feel like two nags; the one-card Home and the fixed weekday keep it to one prompt at a time
- Photo storage is small (about 3 MB per user per month) but it is still the first thing that costs money on a free tier if friends grow
