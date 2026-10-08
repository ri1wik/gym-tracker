# Habit and retention design

Reference material for builders. PLAN.md wins on any conflict.

## Recommendation

Build the whole app around one 20-second daily action and one weekly payoff. The daily action is: open the app, tap the single suggested session on the home card, tick set one with last time's weight and reps already filled in (three taps). The weekly payoff is a Sunday review generated only from the user's own logged week, that pairs the smoothed weight trend with a rising strength trend (the chart that answers "is recomp doing anything?"), says one honest thing, asks for one line in the user's own words, pre-plans next week, and ends in a share card ready for the friends' WhatsApp group. Measure consistency in weeks against a target the user chose, with partial weeks and automatic grace, never in daily streaks that reset. Accept that a serverless PWA cannot fire a notification at a chosen time on any platform, so make the calendar export, the app badge, on-open nudges and above all the group's Sunday-card ritual the reminder system. Ship a hidden local analytics screen so the developer can see whether friends return in week 2 and week 4, and let those numbers decide whether a tiny push sender is ever worth adding.

## What transfers from the reference apps (and what does not)

- Strong and Hevy: the previous-session values sitting beside every set input, a tick per set, and a rest timer that starts on the tick are the most used features in both apps. Copy that pattern exactly; it is the 20-second loop.
- MacroFactor: never make the raw scale reading the headline. Its trend weight is a long-window average that weights recent weigh-ins more, interpolates missing days, and is shown as a separate line from the scale dots. The product's retention story is that users stop reacting to Tuesday's reading.
- Strava: the activity is the post, and kudos from people you know beat any badge the app can give. Transfer: the review card and the PR card are posts for the group chat; the app never needs its own feed.
- Duolingo, from its own published experiments: adding slack (streak freezes) raised daily active learners; decoupling the goal from the streak so one lesson keeps it alive raised day-14 retention by about 3 percent relative; heavier daily goals made people less likely to hold a streak; letting people choose their own commitment improved ownership; the first seven days are where retention is lost. Transfer: a weekly target the user picks, any session counts as showing up, automatic grace for a missed week, and a first week engineered to produce one finished workout and one review.
- Do not transfer: daily streaks that reset, XP, leagues, hearts, leaderboards. Those are tuned by a retention team at huge scale; in a group of friends with different training ages they make the weakest friend quit, and that is the person retention is about.

## The core loop: one daily action, one weekly ritual

- Daily action, under 20 seconds: the home screen is one card, "Next: Upper A, last done Tuesday", with one Start button. Start opens the session with every set prefilled from the last time that exercise was done (weight, reps, rest). Logging set one is one tap on the tick. Open, Start, tick: three taps from the home-screen icon.
- Rest-day action: the home card becomes "Protein today: 0 of 140 g" with the user's five favourite foods as one-tap chips. One tap logs a food. Rest days stay inside the loop without a full diet log.
- One number above the fold: the home card shows sessions this week ("2 of 3") and nothing else. Charts, library, history and diet live behind tabs. A dashboard home screen is the fastest way to make the daily action feel like work.
- Weekly ritual, on the user's chosen review day (default Sunday), in this order: (1) weigh-in capture with the trend value shown next to the raw number; (2) what you did: sessions, hard sets, cardio minutes, protein days hit; (3) what moved: PRs, e1RM change on the three most-trained lifts, trend weight change over 4 weeks, sets per muscle against the range; (4) positives and negatives drafted from the data, then one free-text line from the user ("what felt good, what was hard"); (5) next week: three sessions pre-chosen and one focus line; (6) share card.
- Earned: the review is built only from logged data and states its own basis ("3 sessions, 2 weigh-ins"). A thin week gets a thin review, never padding. Every sentence contains one of the user's own numbers or exercise names; nothing generic.
- Personal: the free-text line is stored and quoted back next week ("Last week you wrote: left shoulder niggle on overhead press"). After a few weeks the reviews are a journal people re-read, and that journal is theirs, not the app's.
- Anchor the ritual in time and place: badge the installed app icon when the review is ready, make "Review ready" the home card on review day, and seed the group norm that everyone posts their card on Sunday evening.

## First three minutes, first workout, first review

- Minute 1: no account, no email. At most three screens: units with height and current weight (this becomes the first chart point), training days per week (2, 3 or 4, default 3), and a starter plan (Full Body A/B for 2 or 3 days, Upper/Lower for 4). Label the button "Commit to 3 sessions a week" rather than "Continue".
- Minute 2: land on the home card already showing "Next: Full Body A, 6 exercises, about 45 min" with the exercise list. Tapping Start shows the logging screen so the user has seen how logging works before they are standing in the gym.
- Minute 3: the diet tab asks once for their five usual protein foods (searchable list, plus a plain "grams of protein" fallback). Skippable, and the tab asks again later. After this, every rest-day log is two taps.
- First workout: placeholders are empty but each row says "enter it once, next time it is here". Rest timer defaults to 90 s and auto-starts. The finish screen shows duration, sets, total volume and "6 first-time records", labelled first-time so later PRs keep their meaning.
- Install moment: right after the first finish screen, and never before, show the banner "Add to home screen: opens in one tap, works offline". On iOS show the two-step share-sheet instruction with a picture; on Android use the install prompt event. Detect standalone mode and never show it again once installed.
- Second open: the home card says "Next: Full Body B" and shows the last session's date. Nothing else changes. Stability in the first week is a feature.
- First review: fire it on the first review day even with one session. It says what it can ("Week 1: 1 session, baseline 78.4 kg, 6 first-time records. Nothing to compare yet; your trend line appears after three weigh-ins"), asks for the free-text line, pre-plans next week and still makes a share card. The "I started" card is the one most likely to be posted.
- Empty states that teach: the weight chart with under three points shows a faded example trend captioned "the dots are water, the line is you"; an exercise with no history says "after one set we will show last time here"; empty history says "your first workout will appear here, Full Body A is ready"; the review tab before Sunday says "unlocks Sunday, 2 of 3 sessions so far".

## Consistency without guilt

- The unit of consistency is the week. The user picks a target (default 3); the home ring shows "2 of 3". Any session with at least one logged set counts as showing up; a 15-minute session counts the same as a 90-minute one.
- Weeks that hit the target form a run of consistent weeks. A week with 1 or 2 sessions is partial (lighter colour), never broken. Two consecutive zero weeks pause the run; nothing ever resets it to zero.
- Once the user has 8 or more weeks of data, replace the run count with a rolling window: "11 of the last 12 weeks". The rolling window is honest and forgiving at the same time, and it never produces a day-one-again moment.
- Automatic grace: one covered week per 8 consistent weeks, applied without asking. Copy: "Week of 14 Sep: rest week, covered". Nobody buys, equips or manages it.
- Missed-week copy on the next open: "Last week was quiet. Your records and your trend are still here. Next: Upper A." No red, no exclamation marks, no count of missed days, no "you broke" anything.
- Comeback after 14 or more days away: the home card becomes "Welcome back. Start light?" which opens the next session with prefilled weights reduced by 10 percent and a one-tap restore. That week's review compares to the last active week, not to the gap.
- Planned time off: a "pause" toggle in the profile marks the week as off; the ring shows a pause icon instead of a shortfall and the review treats it as a non-week. Travel and illness should cost nothing.
- Celebrate the run, not the day: at 4, 8 and 12 consistent weeks the review opens with one milestone line and the share card gets a small mark. That is the entire gamification budget.

## Progress visibility

- "Last time" at log time: each set row shows last session's weight and reps as the placeholder plus a grey "last: 60 kg x 8" label; the steppers start from that value. Beating it turns the tick gold and shows a 400 ms "PR" badge with a short vibration where the browser allows it. No modal.
- PR detection per exercise: heaviest weight, most reps at a weight, best e1RM (Epley: weight x (1 + reps/30)), best single-set volume. Show at most one badge per set, the most impressive one. All PRs collect into the finish summary and the Sunday review.
- e1RM trend per exercise: a sparkline on the exercise page and a line such as "+7.5 kg since 3 Aug". For recomp this is the headline progress number, because the scale is often flat while this rises, and the review says so explicitly whenever it happens.
- Weekly volume tiles: hard sets per muscle group this week shown as a bar against a plain range (10 to 20). Groups under range feed next week's suggested session, so the tile is actionable rather than a vanity total.
- Body weight: trend line solid, raw dots faded, trend computed as a weighted average over the last few weeks with recent values heavier and gaps interpolated. The review quotes trend to trend ("trend 78.1, down 0.4 kg over 4 weeks") and shows raw only in small text. The weigh-in is weekly by ritual, but any extra weigh-ins feed the same trend: more points, calmer line.
- Recomp pairing: the weight chart carries the e1RM of the most-trained lift as a second faded line, so a flat scale beside a rising strength line reads as success. This single chart answers the question that makes recomp users quit: "is anything happening?"
- Progress photos (later): a monthly front and side photo stored locally with a side-by-side view. Powerful for recomp and free, but outside v1 unless cheap.

## Friction killers

- Prefill from the last performance of that exercise, not just the last session of that template, including rest seconds and the last note.
- Steppers with per-exercise increments (2.5 kg barbell, 1 or 2 kg dumbbell, 1 rep), long-press to repeat, tap the number for a decimal keypad (inputmode="decimal").
- Rest timer: auto-starts on the tick, counts from an absolute timestamp so it survives screen lock, shows remaining time in the title and in a persistent bar, plays a short sound and vibrates where allowed, holds a Screen Wake Lock while a session is open, and offers Skip and +30 s.
- One-tap repeat: "Repeat" in history clones a session into today with its sets as targets; "Copy last" at exercise level does the same for one exercise.
- Add exercise mid-session with a search that lists favourites and recents first; a superset toggle so paired exercises share one timer.
- Cardio in two fields: treadmill walk (time, incline, speed or distance) and run (time, distance), last values prefilled, suggested by the home card on non-lifting days when the plan includes them.
- Diet: favourites row, recents row, "same as yesterday", protein-only entry when the food is unknown. One ring, protein first, calories optional.
- Autosave every tap to IndexedDB and restore a half-finished session on the next open ("Resume Upper A, started 18:42"). Losing one session is enough to lose a user.
- JSON export and import from day one. Confidence that months of logs cannot vanish is a retention feature, and it is also the laptop-plus-phone story until sync exists.

## Reminders without a backend: the honest platform picture

- Web Push works on installed PWAs on iOS (16.4 and later) and on Android, but a server has to send every push, so it is out for v1. Scheduled local notifications (Notification Triggers) were a Chrome-only origin trial that never launched and do not exist in Safari. No API fires a notification at a chosen time from a serverless PWA on any platform. Design for that instead of hoping.
- Calendar export (.ics): at the end of onboarding and whenever the plan changes, offer "Add my training days to my calendar": one recurring event per planned day with a built-in alarm, plus the review-day event. iOS Calendar and Google Calendar honour alarms in imported events. This is the only reliable scheduled reminder available, and it is free.
- Badging API: set the icon badge when a review is ready or a session is resumable; clear it on completion. Works on installed PWAs on iOS and Android. It cannot wake the app, so it reflects state computed on the last open, but a badge set at Saturday's session end (review tomorrow) is still visible Sunday morning.
- On-open nudges in priority order, one line on the home card, never a popup: resume unfinished session; review ready; "today is a planned day: Upper A"; "2 of 3 this week, 2 days left"; "next planned day: Thursday".
- Android Chrome only, optional: Periodic Background Sync can wake the service worker roughly daily on an installed, regularly used site and show "Upper A today". Unreliable by design, so wrap it as a nice-to-have that silently does nothing elsewhere.
- The real reminder is the group. When everyone posts the Sunday card in the WhatsApp group, the group is the push notification. Build the card and the Sunday flow so posting is the default.
- Decision rule for v2: if the local analytics show opens on planned days below about half, the first and only backend worth adding is a tiny scheduled push sender ("Upper A today" to subscribed installs). Make that call on data, not up front.

## Social without a server

- Share cards rendered client-side to PNG (hidden canvas or HTML-to-image), handed to the share sheet through the Web Share API with files, which reaches WhatsApp and Instagram stories on iOS and Android. Fallback: download the image.
- Two cards: the Sunday review card (name, week number, sessions ring, PRs, strength trend, optional weight trend, the free-text line) and the PR card (exercise, weight x reps, e1RM, previous best). Portrait 1080 x 1920 for stories and square for chats. Body weight is off by default on cards and switched on per card.
- Share link: compress the week's summary (not the raw log) into the URL fragment and let a friend open it in their own copy of the app, which renders "your week, their week" side by side against the friend's own data. No server, nothing stored, nothing sent beyond the link. Privacy follows from the sender choosing what the summary contains.
- No leaderboards in v1. Comparison is one friend, one week, by invitation, and the view says "you both showed up 3 times" before any numbers. The goal is "we are both doing this", not "who is winning".
- Plan link: export a template as a share link so a friend can import the same plan. Friends on the same plan talk about the same sessions, and that conversation is retention you did not have to build.
- Seed the ritual with the first group: "Sunday card" as the norm. The app's job is a card good enough to be worth posting, ready at the end of the review flow with one tap.

## Personalization

- Review wording by trend: cross the 4-week weight trend (down, flat, up) with the 4-week e1RM trend (up, flat, down) into nine short templates. Flat weight with rising strength: "This is what recomp looks like: the scale is flat and your bench e1RM is up 5 kg." Weight down with strength down: "Weight is dropping faster than strength is holding; check protein and sleep this week." Sessions under target: lead with consistency and say nothing about diet.
- Favourite exercises: rank by frequency over the last 8 weeks, pin to the top of the library and the add-exercise search; remember per-exercise increment, rest time and last note.
- Suggested next workout: rotate through the plan from the last completed session; if a muscle group is under its weekly range and the week has a free day, suggest the session that covers it; after 14 days away suggest the lighter restart.
- Progression hint: when the user hit the top of the rep range on every set for two sessions, prefill the next session at the exercise's increment higher with a "suggested" label and one-tap reject. This is the moment the app feels like it knows them.
- Use the name they typed, their units, and their own exercise names (allow renames and custom exercises).
- Review day, week start and weekly target are user settings with sensible defaults, each changeable in one tap from inside the review.

## Local measurement (never sent anywhere)

- An append-only events store in IndexedDB: app_open (timestamp, standalone or browser, days since last open), session_start, session_finish (duration, sets, started from the suggestion or not), set_logged, weigh_in, review_opened, review_completed (free text present or not), card_shared, link_shared, install_prompt_shown, install_prompt_accepted, ics_exported, data_exported.
- A hidden developer screen (tap the version number five times) with weekly aggregates: active weeks (at least one session or weigh-in), sessions per week against target, week-2 and week-4 return, review completion rate, median seconds from app_open to first set_logged, share of sessions started from the suggested card, percentage of opens on planned days.
- A "send diagnostics" button that exports those aggregates only (never the raw log or body data) as a JSON file the friend can forward by choice. That is the whole telemetry pipeline, and it is honest enough to describe to friends in one sentence.
- Define retained as "at least one session or weigh-in this week" and target week-4 retention; week 2 is the early warning. With five to ten friends, read the numbers as stories (who dropped, at which step) rather than percentages.
- Instrument the three funnel steps that predict the rest: first workout finished within 7 days of first open, first review completed, first card shared. If one is low, fix it before adding anything new.

## Evidence used (compact)

- Duolingo, Improving the streak: decoupling the goal from the streak raised day-14 retention by 3.3 percent relative; heavy daily goals reduced streak holding. https://blog.duolingo.com/improving-the-streak
- Duolingo, How streaks keep learners committed: two equipped freezes raised daily active learners by 0.38 percent relative, with the slack rationale. https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals
- Chrome, Notification Triggers API: Chrome-only, origin trial complete, launch not started; no Safari support. https://developer.chrome.com/docs/web-platform/notification-triggers
- iOS 16.4 brought Web Push and the Badging API to home-screen web apps; push still needs a sending server. https://www.howtogeek.com/873423/web-apps-will-get-a-big-upgrade-on-iphone-and-ipad/
- MacroFactor, weight trend: scale weight and trend are separate values; the trend is a long-window average weighted toward recent values with gaps interpolated. https://help.macrofactorapp.com/dashboard/weight_trend/ and https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/

## Must have

- Home card with one suggested next session and a single Start button; one progress number (sessions this week) above the fold
- Last-time prefill per exercise, plus and minus steppers with per-exercise increments, tick per set, rest timer that auto-starts on the tick, survives screen lock (absolute timestamps) and holds a wake lock
- Autosave every tap and resume a half-finished session on the next open
- Weekly target chosen by the user, progress ring with partial weeks, automatic grace week, pause toggle; no daily streak anywhere
- Sunday review: weigh-in with trend beside raw, what you did, what moved, auto-drafted positives and negatives, one free-text line quoted back next week, next week pre-planned, share card at the end
- Trend weight line with faded raw dots and the most-trained lift's e1RM as an overlay
- Inline PR badge (one per set, 400 ms), first-time-record labelling on the first workout, e1RM sparkline per exercise, weekly sets-per-muscle tiles against a range
- Install banner after the first finished workout only, with iOS share-sheet instructions and standalone detection
- Reminders: .ics export of training days and review day with alarms, Badging API for review ready and resumable session, on-open nudges on the home card
- Share cards (review and PR) through Web Share with files, body weight off by default; share link in the URL fragment opening a one-friend one-week comparison
- Favourites and recents in the exercise picker and the food picker; protein-only quick add and "same as yesterday"
- Nine-template review wording keyed on weight trend crossed with strength trend; favourite-exercise ranking; suggested next workout with the progression hint
- JSON export and import
- Local append-only events log and the hidden developer screen with week-2 and week-4 return, review completion and time-to-first-set

## Later

- Tiny scheduled push sender (the first backend) only if planned-day opens stay below about half in the local analytics
- Periodic Background Sync local notification on Android Chrome installs
- Monthly progress photos stored locally with side-by-side view
- Plan import from a friend's share link
- Optional end-to-end encrypted sync once friends ask for phone and laptop parity beyond export and import
- Rolling 12-week consistency view and the 4, 8, 12 week milestone marks if they do not fit v1 cheaply
- Multi-week friend comparison and a small "cheers" reply card
- Deeper nutrition: calories per food, barcode scan, recipes
- Apple Health and Google Fit import (needs a native wrapper, outside the PWA)
- Per-lift commentary in the review beyond the nine templates
