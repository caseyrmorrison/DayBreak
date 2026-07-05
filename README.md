# Daybreak

A minimalist, local-first daily focus app. It answers one question the moment
you open it: **what do I do right now?**

Most productivity apps make overwhelm worse by showing you everything.
Daybreak's whole job is to start your day with your biggest task and almost
zero overhead.

## The daily loop

1. **Morning kickoff (2 minutes).** One question: *"What's the one thing that
   would make today a win?"* Pick it, optionally add up to two backups, done.
   Hard cap of three tasks — the Ivy Lee method crossed with "eat the frog."
   Unfinished tasks from yesterday and recent brain-dump thoughts appear as
   one-click suggestions.
2. **During the day.** The screen shows your big thing with a Start button
   and a focus timer. Distracting thoughts go into the brain-dump box at the
   bottom and land in an inbox for later — captured, not acted on.
3. **Evening shutdown (1 minute).** Close the day: unfinished tasks roll into
   tomorrow's suggestions, and finishing your big thing extends your streak.
   Forgot to close? Starting the next morning finalizes yesterday
   automatically, so streaks are never lost to a missed ritual.

Deliberately absent: projects, tags, due dates, priorities, accounts.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript (strict)
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Zustand](https://zustand.docs.pmnd.rs) with `persist` for state
- [Zod](https://zod.dev) for schema validation at the storage boundary
- [Motion](https://motion.dev) for micro-animations
- [Vitest](https://vitest.dev) + Testing Library for tests

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script               | What it does                           |
| -------------------- | -------------------------------------- |
| `npm run dev`        | Dev server with hot reload             |
| `npm run build`      | Production build                       |
| `npm start`          | Serve the production build             |
| `npm test`           | Run the Vitest suite once              |
| `npm run test:watch` | Run tests in watch mode                |
| `npm run lint`       | ESLint (includes React Compiler rules) |

## Data and privacy

All data lives in your browser's `localStorage` under the `daybreak.v1` key —
there is no backend, no account, and nothing leaves your machine. Plans older
than 30 days are pruned automatically. Clearing site data resets the app.

## Security notes

Local-first keeps the attack surface small, but the app is still built
defensively:

- **Validation at the trust boundary.** Anything read back from
  `localStorage` is parsed with a zod schema before it touches app state;
  corrupt or tampered data falls back to a fresh state instead of crashing or
  injecting unexpected shapes.
- **Input hygiene.** All free-text input is trimmed, whitespace-collapsed,
  and length-capped in the store (not just in the UI). Collection sizes are
  bounded (3 tasks/day, 200 inbox items).
- **Security headers** in [next.config.ts](next.config.ts): a restrictive
  Content-Security-Policy (`default-src 'self'`, `frame-ancestors 'none'`,
  `object-src 'none'`), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and HSTS.
  `script-src` currently allows `'unsafe-inline'` because Next.js injects
  bootstrap inline scripts; moving to per-request nonces via middleware is on
  the roadmap. Dev-only relaxations (`'unsafe-eval'`, `ws:`) are gated on
  `NODE_ENV`.
- **No dangerous sinks.** No `dangerouslySetInnerHTML`, no `eval`, no dynamic
  HTML construction; React's escaping handles all user text.
- **IDs** come from `crypto.randomUUID()`, not `Math.random()`.

Run `npm audit` periodically; the app intentionally has a small dependency
footprint.

## Project structure

```
src/
  app/            Next.js app router (layout, page, globals)
  components/     UI: Kickoff, TodayView, TaskRow, FocusOverlay,
                  BrainDump, InboxSheet, ShutdownDialog
    ui/           shadcn/ui primitives (button, input, dialog)
  lib/
    dates.ts      Date-key helpers (local timezone, streak math)
    schema.ts     Zod schemas + input limits (single source of truth)
    store.ts      Zustand store, persistence, streak/rollover logic
```

## Roadmap

- CSP nonces via middleware (drop `'unsafe-inline'` for scripts)
- Installable PWA with offline service worker
- Optional multi-device sync (local-first engines: Electric SQL, Zero)
- Keyboard palette (cmd+K) for capture and navigation
