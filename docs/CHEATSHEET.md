# Daybreak cheat sheet

Everything on one page. See [USER-GUIDE.md](USER-GUIDE.md) for the
walkthrough, [ARCHITECTURE.md](ARCHITECTURE.md) for internals.

## URLs

| What | URL |
|---|---|
| Production (any device, anywhere) | https://daybreak-crmorrison.vercel.app |
| Local (on the Mac) | http://localhost:3200 (and :3000 redirects there) |
| Local from phone/tablet on home wifi | http://caseys-macbook-pro.local:3200 |
| Fix a stuck/stale app | append `/reset.html` to any of the above |

## Keyboard

| Keys | Does |
|---|---|
| ⌘K / Ctrl+K | Open capture palette (works on every screen) |
| type + Enter (palette) | Send thought to inbox |
| ↑ / ↓ + Enter (palette) | Pick an action (focus, mark done, close day, sync) |
| Esc | Close palette / leave focus mode |
| Enter (brain-dump box) | Capture to inbox |

## The daily loop

morning: pick **one big thing** (+ up to 2 backups) → **Start the day**
→ work: **Start** = focus timer; stray thoughts → ⌘K → inbox
→ evening: **Close the day** → unfinished rolls to tomorrow, streak ticks.

Past days: tap the streak in the footer (or ⌘K → "Show history") —
read-only, last 30 days.

Next day: close the day → "Plan tomorrow" (or ⌘K → "Plan tomorrow").
A prepared plan is locked (read-only) until its date arrives, then
becomes your active day automatically.

## Commands (run in the project folder)

| Command | Does |
|---|---|
| `npm run dev` | Dev server with hot reload (:3000) |
| `npm run build` | Production build |
| `npm run prod` | Serve production build on :3200 |
| `npm test` / `npm run test:watch` | Run the 61-test suite |
| `npm run lint` | ESLint |
| `npx vercel ls` | List cloud deployments |
| `npm audit` | Dependency vulnerability check |

### After a Mac reboot (local server only)

```bash
cd ~/Development/Daily-Organization-Motivation
nohup npx next start -p 3200 > ~/Library/Logs/daybreak.log 2>&1 &
nohup node scripts/port3000-redirect.mjs > /dev/null 2>&1 &
```

(Not needed if you only use the Vercel URL.)

## Ship a change

```bash
git checkout develop          # daily work happens here
# …edit, commit…
git push                      # → automatic PREVIEW deployment
git checkout main
git merge develop
git push                      # → automatic PRODUCTION deployment
```

Preview deployments stay behind Vercel login; production is public.

## Sync quick reference

| Task | How |
|---|---|
| See/copy your code | Footer → Sync → Show sync code |
| Link a new device | Open app there → "Set up sync" → paste code → Link |
| Force a sync | Footer → Sync → Sync now (or ⌘K → "Sync now") |
| Rotate the code | Sync → Delete server copy → Create a sync code → re-link other devices |
| Stop syncing one device | Sync → Unlink this device (local data stays) |

The code is both identity and encryption key. Anyone holding it can read
and write your synced data; losing it makes the server copy unrecoverable.

## Where things live

| Thing | Location |
|---|---|
| Your data (per browser) | localStorage key `daybreak.v1` |
| Sync pairing code (per browser) | localStorage key `daybreak.sync.v1` |
| Cloud vault (ciphertext only) | Turso db `daybreak` (org `caseyrmorrison`) |
| Local vault (only without Turso env) | `data/daybreak-sync.db` |
| Server env (local) | `.env.local` — gitignored, never commit |
| Server env (cloud) | Vercel → daybreak → Settings → Environment Variables |
| Local server logs | `~/Library/Logs/daybreak.log` |
| Repo | https://github.com/caseyrmorrison/DayBreak (`main` + `develop`) |

## Troubleshooting one-liners

| Symptom | Fix |
|---|---|
| Stuck on "Loading your day…" | Reload; if it persists, visit `/reset.html` |
| "Sync issue" in footer | Open Sync dialog for the error; usually server unreachable — Sync now retries |
| Wrong-code error when linking | Re-copy the code; O/0 and I/L/1 are interchangeable, length must be 32 chars |
| Day planned on wrong date | Days key off local midnight; check the device clock |
| Fresh start (one browser) | DevTools → clear site data (or `localStorage.clear()`) — synced copies unaffected |
