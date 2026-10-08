# Visual and interaction design system

Reference material for builders. PLAN.md wins on any conflict.

## Recommendation


## Feel statement

- A good stopwatch, not a spreadsheet: instant, legible at arm's length, and never in the way of the next set.
- Decision test for every screen: if a change adds a tap, a wait or a word between the user and the next set, it is wrong, however pretty it is.

## Visual identity: palette, dark first

- Dark surfaces (OLED-friendly, not pure black so scrolling does not smear): bg #0B0D10, surface-1 #14171C (cards), surface-2 #1C2027 (inputs, active rows, overlays), surface-3 #262B33 (pressed, tracks). Hairlines: white at 8% (line) and 14% (line-strong).
- Dark ink: ink-1 #F2F4F7 (17:1 on bg), ink-2 #A3ABB8 (8:1, meta and secondary), ink-3 #6B7480 (labels and placeholders only, never information the user needs mid-set).
- Accent for actions, 'ember': #FF7A1A fill, #FF8F42 hover, #E66A10 pressed, text on it #1A0E05 (7.2:1), soft tint at 14% for chips and active sidebar rows. As text: #FF7A1A on dark (7.4:1), #B4480A on light (5.1:1). Ink-on-ember buttons in both modes keep one button look everywhere.
- Success, PRs and positive review items, 'mint': #3DDC84 fill, text on it #06281A (9:1), soft tint 14% dark / 20% light. As text: #3DDC84 on dark (10.9:1), #15803D on light (4.7:1).
- Needs-attention review items, 'rose': #FB7185 on dark (7.2:1), #E11D48 fill and #BE123C text on light (5.9:1), soft tint 14% dark / 10% light. The UI never says 'negative' or 'failed'; the badge reads 'Needs attention' and every such card carries one concrete fix.
- Light variant, same semantic names: bg #F6F7F9, surface-1 #FFFFFF, surface-2 #EEF0F3, surface-3 #E3E6EB, hairlines #10141A at 8% and 14%, ink-1 #10141A, ink-2 #5B6472 (5.6:1), ink-3 #8A93A1 (2.9:1, decorative only).
- Chart series, validated for colour vision in this slot order in both modes (dark / light): 1 ember #E8640A / #D4560A (weight, strength), 2 sky #3987E5 / #2A78D6 (cardio), 3 gold #C98500 / #C98500, 4 violet #9085E9 / #4A3AA7, 5 magenta #D55181 / #D55181, 6 teal #1A9DB3 / #0E8FA3. Status colours (mint, rose) are never used as a series. Stacked bars need a 2 px surface gap and direct labels; scatter-style charts cap at two series because gold and ember fail the all-pairs check.
- Tailwind wiring: expose tokens as RGB channel triplets on :root (dark) and [data-theme=light] (for example --bg: 11 13 16) and map them in theme.extend.colors as 'rgb(var(--bg) / <alpha-value>)' so opacity modifiers like bg-accent/15 work; theme toggle writes data-theme and 'auto' follows prefers-color-scheme; set color-scheme on :root so native controls match; set <meta name=theme-color> to #0B0D10 and #F6F7F9 per theme.

## Typography

- One variable font: Inter from Google Fonts with the optical-size axis (family=Inter:opsz,wght@14..32,400..800). Self-host the latin woff2 subset (about 100 KB, outside the JS budget) and precache it; use font-display: optional with a size-adjusted system fallback (@font-face size-adjust, ascent-override, descent-override) so first paint has zero layout shift and the second visit is always Inter.
- Every number wears tabular numerals: a .num utility (font-variant-numeric: tabular-nums; font-feature-settings 'tnum' 1, 'cv11' 1) or Tailwind tabular-nums, so columns and timers never jitter.
- Scale for a 390 px phone (size / line-height / weight / tracking): display-xl 56 / 1.0 / 800 / -0.02em (expanded rest timer, weekly weigh-in), display 40 / 1.05 / 700 / -0.02em (hero numbers), h1 28 / 1.15 / 700 / -0.01em (screen titles, workout timer), h2 22 / 1.2 / 600, h3 17 / 1.3 / 600 (card titles, exercise names), body 16 / 1.5 / 400, body-strong 16 / 600, small 14 / 1.4 / 500 (meta, previous set), caption 12 / 1.3 / 600 uppercase 0.06em (labels), stepper and set values 22 to 24 / 700.
- Inputs never render below 16 px (iOS zooms on focus otherwise). Declare the scale in tailwind fontSize as [size, { lineHeight, letterSpacing, fontWeight }] tuples so one class carries the whole style.

## Spacing, radius, elevation

- 4 px base scale, used steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Page gutter 16 on phone, 24 on tablet, 32 on laptop. Card padding 16, cards stacked with gap 10 to 12, sections with gap 24. Safe areas via viewport-fit=cover and padding-bottom: env(safe-area-inset-bottom) on the tab bar and sheets.
- Corner radius: 6 for chips and small inputs, 10 for buttons and text inputs, 14 for cards, 20 for bottom sheets, full for pills, rings and stepper buttons. Nested rule: inner radius = outer radius minus padding, so a 10 px button inside a 14 px card with 4 px padding stays concentric.
- Elevation on dark comes from surface steps and hairlines, not shadows (they vanish on dark): level 0 bg; level 1 cards = surface-1 + line 8%; level 2 inputs, active set row = surface-2 + line 14%; level 3 overlays (sheets, rest dock, toasts) = surface-2 at 92% + backdrop-blur 14 px + shadow 0 -8px 32px rgba(0,0,0,.5).
- Elevation on light uses the same surface steps plus soft shadows: sm 0 1px 2px rgba(16,20,26,.06), md 0 4px 12px .08, lg 0 12px 32px .14. Pressed state is a background step to surface-3 in 80 ms, no scale. Focus ring 2 px accent, 2 px offset, on :focus-visible only.

## Component inventory

- Bottom tab bar: five destinations, Today, Train, Eat, Progress, Me. 56 px tall plus safe area, 24 px stroke icons, 11/600 labels, active state is accent text and icon with no pill, surface-1 at 92% with backdrop blur and a hairline top. Each tab is a full fifth of the width by 56 px of hit area.
- Resume pill: while a workout is live, a 44 px 'Resume · Push day · 23:14' pill docks above the tab bar on every screen (the mini-player pattern). It is the single strongest guard against abandoned sessions and costs one component.
- Buttons: primary 48 px (56 px for the one main action per screen: Start workout, Finish, Log weigh-in), ember fill, ink-on-ember 16/600, radius 10; secondary surface-2 with a hairline; ghost accent text; destructive actions are rose text and confirm through an undo toast, never a modal.
- Tap targets: 44 px minimum, 48 preferred, 56 for set-row controls, 8 px between neighbours. A visual can be smaller (a 32 px check) while the hit area is enlarged with padding or a ::before pseudo-element. touch-action: manipulation on every control kills the 300 ms double-tap delay.
- Numeric steppers: [minus] value [plus] in a 48 px surface-3 pill, 48 by 48 buttons, value 22/700 tnum centred and tappable to open a decimal keypad (inputmode=decimal). Increments per equipment: barbell 2.5 kg, dumbbell 1 kg, machine 5 kg, reps 1. Long press repeats at 8 per second after 350 ms. Each step changes the value synchronously with a 10 ms vibration and no animation.
- Set rows: grid 36 / 64 / 1fr / 1fr / 48 (set, prev, kg, reps, done), 56 px tall, radius 12. Pending rows are prefilled with last session's numbers in ink-3 so a repeat set is one tap; the active row is surface-2 with steppers; a done row is mint-soft with a mint set badge and filled check. Tapping 'prev' copies it in. Completing a set pops the check (180 ms), vibrates 20 ms, starts the rest timer, activates the next row and scrolls it into view. Swipe left reveals delete; delete is undoable for 5 s.
- Rest timer overlay: non-modal dock above the tab bar, 64 px tall: 48 px ring (stroke 5, accent on a surface-3 track), remaining time 28/800 tnum, -15, +15 and Skip buttons (40 tall, 52 wide). Tapping the time expands a sheet with 72 px numerals. The countdown is computed from a stored end timestamp, so it survives backgrounding and reloads. At zero: vibration 100/50/100/50/200, an optional beep (off by default) and a Notification when installed and granted. On laptop the countdown mirrors into document.title.
- Progress rings and bars: 72 px ring (stroke 7, round caps) for sessions this week with the fraction 18/700 inside; 48 px ring in the rest dock. Bars 12 px tall, radius full, surface-3 track; the fill is ember below target and switches to mint when the target is met, which is the reward. Rings fill once on mount (500 ms) and never animate on data updates.
- Trend chart (weight, estimated 1RM, weekly volume): hand-rolled SVG, no chart library. 7-day exponential moving average as a 2 px series-1 line with monotone cubic smoothing, raw daily points at radius 2.4 and 35% opacity (1.6 and 22% beyond 45 days), 8% area fill under the line, a dashed ink-3 goal line, three horizontal hairline gridlines with right-side labels in ink-3 11 px, no vertical gridlines, no legend for a single series. Touch scrub shows a vertical cursor, a ringed dot on the average and a pill label '82.9 kg · avg'; hover does the same at pointer:fine. The container is a fixed aspect box (342:118 phone, 342:130 laptop) so it never shifts layout. Default range 30 days on phone, 90 on laptop, segmented control 4w / 12w / 6m / all.
- Calendar heat strip: 12 weeks by 7 days, 13 px squares, 3 px gap, radius 3, columns are weeks and rows Monday to Sunday. Levels: none surface-3, 1 ember at 35%, 2 at 65%, 3 at 100%, keyed to session length (under 20 min, 20 to 45, over 45; cardio counts). Today has a 2 px ink-1 outline; weigh-in days get a 3 px dot. Stats sit to its right: current streak, total sessions, best streak. Tapping a square opens that day.
- Weekly review cards: badge first (24 px pill in caption type: mint-soft 'Positive' or rose-soft 'Needs attention'), a 3 px coloured left rail, 17/600 title, one line of evidence in ink-2 with tnum numbers, a metric chip top-right ('4 of 4', '+2.5 kg'). Positives come first; attention items are capped at two per week and each one names a fix.
- Protein bar on Eat: hero number 22/700 '112 / 150 g', 12 px bar that turns mint at target, then the helper's suggestion chips ('Greek yogurt +17 g') as 36 px neutral chips that log with one tap and offer undo. Meal segments appear as hairline dividers on the bar at laptop width only.
- Empty states: no illustrations (budget). A 32 px icon in a 56 px surface-2 circle, an h3 title, one line of ink-2 and one primary button, always prefilled with the likeliest action: 'Repeat Monday's Push', 'Log 82.6 kg again?'.
- Toasts: bottom, above the tab bar and the rest dock, 56 px, surface-2 with a 3 px rail (mint for PRs, ink for undo, rose for errors), 20 px icon, 15/600 text, an accent action on the right. Slide up 200 ms, auto-dismiss at 4 s (undo at 5 s), swipe down to dismiss, at most two stacked; more PRs collapse into '3 PRs this session'. The PR toast reads 'New PR · Bench 62.5 kg × 8' and taps through to that exercise's history.
- Bottom sheets replace dialogs on phone: exercise picker and keypad slide up with a 20 px top radius, a 36 by 5 drag handle, a sticky 48 px search field, a body-part chip row, recent exercises first and the full library grouped by body part. Segmented control (kg/lb, ranges): 40 px, surface-2 track, surface-3 thumb. Headers: large 28 px title collapsing to 17 on scroll with the workout timer staying pinned.

## Motion

- Budget: every interaction responds under 100 ms; UI transitions run 120 to 250 ms; nothing exceeds 600 ms except the rest timer itself. Easing: cubic-bezier(.2,.8,.2,1) for entrances, 160 ms ease-in for exits, one spring cubic-bezier(.2,.9,.3,1.4) reserved for the set-complete pop.
- On: set complete (check scales .8 to 1 in 180 ms, row background to mint-soft in 300 ms, 20 ms vibration, the next row activates in the same frame); PR confetti (a 60-line canvas, 40 particles in ember and mint, 600 ms, only on the first PR of a session, after the toast lands); count-up on Progress stat tiles (400 ms, first mount per visit only); ring fill on mount (500 ms); sheet open 220 ms translateY, close 160 ms; toast slide 200 ms; weekly review cards stagger 40 ms each, capped at five, only on first open of that week; tab switches crossfade 120 ms or not at all.
- Off: steppers and inputs are synchronous; nothing animates between a tap and a logged set; no page transition that blocks input; no skeleton shimmer for local data (render from the in-memory store in the same frame); chart redraws on data change cap at 150 ms and never animate during scrub; no splash animation, no onboarding carousel, no ripple that waits for release.
- prefers-reduced-motion: all transforms removed, opacity-only at 0 ms, confetti and count-up off, haptics stay.

## Laptop layout

- Breakpoints: base 390 phone; md 768 keeps the tab bar with content capped at 640 px centred; lg 1024 swaps in a 72 px icon rail; xl 1280 widens it to a 240 px sidebar with labels. Content max-width 1120, gutter 32.
- Sidebar: brand, the five destinations as 44 px rows with an accent-soft active state, a primary 'Start workout' button, and at the bottom storage status, export backup and theme. Keyboard map: N new workout, / exercise search, 1 to 5 switch sections, ? shows the map.
- Dashboard in two columns (7/12 and 5/12): left holds today's workout (or the next suggested one) and the weekly review; right holds the weight chart, the consistency strip and the protein bar. Charts grow to 280 px tall and 90 days with a hover crosshair and tooltip, range control top-right.
- Workout table with real keyboard entry: 36 px inputs 72 px wide with tnum and a 2 px accent focus ring; Tab moves kg to reps to the next row; Up and Down step by the exercise increment (Shift for 5x); Enter logs the set and starts rest; Shift+Enter adds a set; Esc cancels; Backspace on an empty new row removes it. Steppers hide at pointer:fine and show at pointer:coarse. The rest timer docks bottom-right as a 260 px card and mirrors into the title.
- Diet on laptop: food entry and the protein helper on the left, the day summary on the right. Hover states exist only under (hover: hover) and nothing depends on them.

## Accessibility and gym conditions

- Contrast (measured): ink-1 17:1 in both modes; ink-2 8:1 dark and 5.6:1 light; accent text 7.4:1 dark and 5.1:1 light; mint text 10.9:1 dark and 4.7:1 light; rose text 7.2:1 dark and 5.9:1 light; ink on ember buttons 7.2:1. ink-3 is decorative only. prefers-contrast: more raises hairlines to 24% and ink-2 to #C3CAD4 dark / #3F4754 light.
- Arm's-length rule: any number read mid-set is at least 22 px at weight 700 with tabular figures (stepper values 22, workout timer 28, rest time 28 in the dock and 72 expanded, weekly weight 40 to 56). Captions never carry information needed mid-set.
- One-handed use: primary actions live in the bottom 60% of the screen; sheets instead of centred dialogs; the set-done check sits on the right with a left-handed mirror setting; no long-press-only or swipe-only actions (every gesture has a button twin); the tab bar stays reachable on every screen.
- Haptics: a tiny haptic(kind) helper around navigator.vibrate with patterns tick 10, confirm 20, success 30/40/30, timerEnd 100/50/100/50/200, error 50, feature-detected and switchable in settings. iOS Safari has no vibration API even when installed, so iOS users get the visual flash and the optional sound; no feedback may rely on haptics alone.
- Screen: Wake Lock held during a live workout (Safari 16.4 and later) and released on finish. Dark surfaces suit OLED and low light; light mode must pass the same contrast because many gyms are bright.
- Screen readers and keyboard: the tab bar is a nav with aria-current; set rows are a table with headers; the rest timer announces at 30 s and 10 s through an aria-live polite region; toasts are aria-live polite; stepper buttons carry labels such as 'plus 2.5 kilograms'; a visible focus ring everywhere.
- Text scaling and touch: all sizes in rem and layouts verified at 130% system text; tnum keeps columns steady; 44 px targets with 8 px gaps; touch-action: manipulation on controls; inputs at 16 px minimum.

## Performance budget

- JavaScript hard cap 200 KB gzipped, target 120. Allocation: framework 10 to 45, router 2, store and IndexedDB wrapper 8, charts 6 (hand-rolled SVG, optionally d3-shape for curves), icons 8 (Lucide tree-shaken into one inline sprite of about 30 icons), UI code 40, service worker 3. Enforce with size-limit in GitHub Actions and fail the Pages deploy over the cap.
- Stack: Vite plus Preact (or Svelte 5 / Solid). Delete the stale create-react-app node_modules in /Users/ri1wik/gym-tracker; there is no package.json and the toolchain is the webpack and jest generation. React 19 fits (about 45 KB) but spends a quarter of the budget. Tailwind with content purge keeps CSS under 15 KB gzipped.
- Font: self-hosted Inter variable latin woff2 (about 100 KB, outside the JS budget), precached by the service worker; font-display: optional plus a size-adjusted fallback gives zero layout shift on first visit and the real font from the second.
- Instant navigation: all primary routes in one bundle (Profile and Settings may lazy-load); data hydrates once from IndexedDB into memory at boot (under 50 ms for a year of logs) and every screen renders synchronously from memory. A spinner for local data is a bug.
- No layout shift: fixed aspect boxes for charts, fixed tab bar and header heights, reserved space for the rest dock and toasts, skeletons only where final sizes are known (the later sync layer). Targets: CLS 0, INP under 100 ms, LCP under 1.5 s first visit on a mid-range Android over 4G and under 0.5 s on repeat visits.
- Offline from the second visit: vite-plugin-pwa (Workbox) precaching the shell, font and icons with navigateFallback to index.html under the /gym-tracker/ base; registerType 'prompt' with an in-app 'Update ready' toast, never an automatic reload mid-workout. Manifest: display standalone, theme and background #0B0D10, maskable 512 icon, apple-touch-icon 180, apple-mobile-web-app-status-bar-style black-translucent, viewport-fit cover.
- Storage safety: IndexedDB with navigator.storage.persist() requested after the first saved workout; an install-to-home-screen prompt after the second session (iOS evicts an uninstalled web app's storage after 7 days without use, and only installed apps can notify); a weekly reminder to export a JSON backup; versioned schema with migrations.

## Draft deliverable and how it was checked

- Rendered and inspected in both themes at 800 and 1320 px wide; three overflow and overlap defects found on the first render were fixed (Home chart and Review button under the tab bar, heat cells as rectangles, laptop rest dock over the protein card).
- The six chart colours were validated with the dataviz palette validator: lightness band, chroma floor, colour-vision separation, normal-vision floor and contrast all pass in both modes in the same slot order. Only the all-pairs case (scatter forms) fails on gold against ember, hence the two-series cap there.
- Nothing in the draft is final; it exists so the user can react to the feel, the accent, the density and the review-card tone before a component is written.

## Must have

- Dark-first semantic token set with the light variant from day one, wired as RGB channel variables in Tailwind so no component names a raw hex
- Set rows prefilled with last session's numbers so a repeated set is one tap, with the done check starting the rest timer in the same frame
- Resume-workout pill above the tab bar on every screen while a session is live
- Rest timer dock computed from a stored end timestamp, with vibration where available, an expand-to-sheet view and title mirroring on laptop
- PR toast with tap-through to the exercise history and a once-per-session confetti burst that respects reduced motion
- Weekly review cards with Positive and Needs attention badges, positives first, attention capped at two and each paired with a fix
- Trend chart with a 7-day average line, faint raw points, goal line and touch scrub, in a fixed aspect box
- Calendar heat strip with today outlined, weigh-in dots and streak, total and best-streak stats beside it
- 44 px targets, 16 px inputs, tabular numerals on every number, 22 px minimum for anything read mid-set, Wake Lock during workouts
- Service worker precache of shell, font and icons; size-limit in CI at 200 KB gzipped; install-to-home-screen prompt after the second session
- Laptop sidebar with the two-column dashboard and full keyboard entry in the workout table (Tab, arrows, Enter, Shift+Enter, Esc)

## Later

- Shareable PR and weekly-review cards rendered to an image for messaging friends (canvas, no backend)
- Plate calculator inside the weight stepper and a lb toggle through the segmented control
- Estimated 1RM per lift and body-measurement charts once the weight and volume charts are solid
- Exercise demonstration media (compressed GIF or line illustration) loaded on demand, outside the JS budget
- Timer sound pack and a per-exercise rest default learned from the user's own skips and extensions
- Theme auto by time of day and an alternate accent for users who dislike orange
- Sync status in the sidebar and a conflict-free merge once the optional sync layer exists
- Sidebar keyboard shortcut overlay and command palette on laptop
