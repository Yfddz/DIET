# Plate — Diet Planner (PWA)

A bright, mobile-first meal planner with macro rings and meal-time notifications.
Built around your reflux-aware muscle-gain plan: 2,500 kcal · ~150 g protein, 6 feeds, dinner by 8.

## Files
| File | What it is |
|---|---|
| `index.html` | The app (UI + inline styles) |
| `app.js` | Tracker logic, persistence, notification scheduler |
| `sw.js` | Service worker — offline + notification clicks |
| `manifest.json` | Makes it installable to the home screen |
| `icon-192/512(.png)`, `icon-512-maskable.png`, `apple-touch-icon.png`, `favicon.png`, `logo.svg` | App icons + logo |

> Keep all files together in **one folder**, with `index.html` at the root.

## Deploy (it only works on HTTPS — install + notifications won't run from a file or this chat's preview)

Same flow as Nightshift. Pick one:

- **Drag-and-drop:** vercel.com → *Add New → Project → Deploy* → drag this folder in.
- **CLI:** `npm i -g vercel`, then run `vercel` inside the folder.
- **GitHub:** push the folder to a repo, then *Import* it on Vercel.

## Install on your phone
- **Android / Chrome:** open the Vercel URL → menu (⋮) → **Install app**. (Or tap the **Install** button in the header when it appears.)
- **iPhone / Safari:** Share → **Add to Home Screen**.

## Notifications
Tap the **bell** (bottom-right) → toggle **Enable reminders** → allow permission → hit **Send a test notification** to confirm it shows.

- On **Chrome / Android**, reminders use the **Notification Triggers API** and fire at meal times **even when the app is closed**.
- On browsers without trigger support, reminders fire **while the app is open** in the background. For guaranteed closed-app delivery everywhere, the next step is a small push server (Web Push + VAPID keys) — out of scope for a static deploy.
- **iOS** web notifications require the app to be **added to the Home Screen** first (iOS 16.4+) and can be flaky.

Feed times are editable in the bell sheet.

## Streak & history
Plate keeps a rolling, on-device history of each day. The card under your feeds shows a **7-day strip** (a dot per day — filled green when every feed was logged, amber when partial) and your **current day streak**. A day counts toward the streak when all its feeds are logged; today stays "in progress" without breaking yesterday's streak.

**Tap the streak card** (or any day dot) to open **History**:
- Weekly stats — avg kcal/day, avg protein, days on target, and your best-ever streak.
- A list of recent days; tap any one to expand what you logged, feed by feed.

## Customize — in the app
Tap **Edit plan** (top-right of *Your day*) to change everything without touching code:

- **Daily targets** — calories, protein, carbs, fat (the rings retune instantly).
- **Feeds** — edit a feed's name, foods, time, and per-feed macros; **add** or **remove** feeds; or **reset to the default plan**.

Meal cards now render from this data, so there's a single source of truth — no need to keep `index.html` and `app.js` in sync by hand. Everything you edit is saved locally on your device.

> Advanced: `DEFAULT_PLAN` and `DEFAULT_MEALS` at the top of `app.js` are the factory defaults used on first run and by **Reset to default plan**.

## Privacy
Everything (today's log, your reminder settings) is stored **locally on your device** via `localStorage`. Nothing is sent anywhere.
