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

## Customize
Open `app.js` — `PLAN` and `MEALS` at the top are the single source of truth (calories, protein, foods, default times). If you change a meal's name/foods/macros, also update the matching card in `index.html` so the display matches. Give me your height and I'll retune the targets.

## Privacy
Everything (today's log, your reminder settings) is stored **locally on your device** via `localStorage`. Nothing is sent anywhere.
