# Daybreak architecture

How the code works, layer by layer. Written for a technical reader who
wants to modify the app confidently.

## The big picture

Daybreak is a **local-first single-page app**. The browser owns the data;
servers are optional conveniences:

```
┌─────────────────────────────┐        ┌──────────────────────────┐
│ Browser (each device)       │        │ Server (Next.js)         │
│                             │        │                          │
│  React UI ── zustand store  │  HTML  │  / (dynamic, nonce CSP)  │
│       │           │         │◄───────│  src/proxy.ts            │
│  localStorage ◄───┘         │        │                          │
│  (daybreak.v1, zod-gated)   │  JSON  │  /api/sync ── libsql ────┼──► SQLite file
│                             │◄──────►│  (encrypted blob vault)  │    or Turso cloud
│  service worker (offline)   │        │                          │
└─────────────────────────────┘        └──────────────────────────┘
```

Three consequences of this shape:

1. The app is fully usable with the network gone — reads and writes hit
   `localStorage`; the service worker serves the shell.
2. The server never sees plaintext user data. The sync vault stores
   ciphertext under an unguessable id.
3. There are no accounts. Identity is knowledge of a pairing code.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router, React 19 | One dynamic page; the framework mostly provides the server plumbing (proxy, API route, headers) |
| State | Zustand + `persist` | Tiny API, no boilerplate, middleware handles storage |
| Validation | Zod | One schema is the source of truth for types *and* runtime gates |
| Styling | Tailwind v4 + shadcn/ui (Base UI) | Utility CSS plus owned component code |
| Crypto | @noble/hashes, @noble/ciphers | Pure-JS, audited; works where WebCrypto `subtle` doesn't (plain-http LAN origins) |
| Sync storage | @libsql/client | Same client speaks `file:` SQLite locally and `libsql://` Turso in the cloud |
| Tests | Vitest + Testing Library | 61 tests across domain, merge, crypto, protocol, components |

## Directory map

```
src/
  proxy.ts              Per-request CSP nonce + security policy (Next "proxy" convention)
  app/
    layout.tsx          Fonts, metadata, service-worker registration
    page.tsx            Forces dynamic rendering (nonce requires it), mounts the app
    manifest.ts         PWA manifest (metadata route)
    api/sync/route.ts   The vault: pull / push (compare-and-swap) / delete
  components/
    DaybreakApp.tsx     Hydration gate, today-key ticker, sync engine lifecycle
    Kickoff.tsx         Morning planning form (+ suggestion chips)
    TodayView.tsx       Main screen: big thing, backups, footer
    TaskRow.tsx         Checkbox row (role="checkbox", motion check animation)
    FocusOverlay.tsx    Full-screen focus timer
    BrainDump.tsx       Capture input → inbox
    InboxSheet.tsx      Inbox dialog: promote / delete
    ShutdownDialog.tsx  Close-the-day summary and confirmation
    CommandPalette.tsx  cmd+K palette (capture + contextual actions)
    SyncDialog.tsx      Create/link/rotate sync, status, unlink
    ui/                 shadcn primitives (button, input, dialog)
  lib/
    schema.ts           Zod schemas + LIMITS (single source of truth)
    store.ts            Zustand store, persistence, migration, domain rules
    dates.ts            Date-key helpers (local timezone), greeting
    merge.ts            Pure record-level merge for sync
    sync-crypto.ts      Pairing codes, key derivation, AES-GCM blobs
    sync.ts             Sync engine: transport, cycle, auto-sync triggers
    ui-store.ts         Ephemeral UI state (palette, focus, sync status)
    server/db.ts        libsql client factory (file: or Turso via env)
public/
  sw.js                 Service worker (offline app shell)
  reset.html/.js        Recovery page: unregister SW + clear caches
scripts/
  port3000-redirect.mjs Convenience redirect :3000 → :3200
```

## Data model and the trust boundary

[schema.ts](../src/lib/schema.ts) defines everything once:

- `Task` — id (UUID), title, optional note/estimate, done, completedAt.
- `DayPlan` — date key (`YYYY-MM-DD`, local timezone), 1–3 tasks
  (**index 0 is the big thing**), optional `shutdownAt`, `updatedAt`.
- `InboxItem` — id, text, createdAt. Immutable once created.
- `PersistedState` — plans record, inbox, `inboxDeletions` (tombstones),
  streak, settings. Everything that syncs.

`LIMITS` caps every string and collection (200-char titles, 3 tasks/day,
200 inbox items, 30-day retention). The store enforces these *in the
mutation functions*, not just the UI — a hostile or buggy caller cannot
overfill state.

The zod schema is enforced at two trust boundaries:

1. **localStorage rehydration** — the persist middleware's `merge` option
   runs `persistedStateSchema.safeParse`; corrupt/tampered storage falls
   back to a fresh state instead of crashing.
2. **Sync decryption** — a blob pulled from the vault is validated after
   decrypting, before it can touch app state.

## State lifecycle

[store.ts](../src/lib/store.ts) wraps everything in `persist`:

- **Versioning**: persisted version is `2`. `migratePersistedState`
  upgrades v1 data (adds `updatedAt` stamps as epoch, empty tombstones).
  Epoch stamps mean "anything newer wins a merge."
- **Hydration**: SSR renders a loading placeholder; the client calls
  `rehydrate()` in an effect. `skipHydration: true` avoids SSR/client
  mismatches. Three failsafes guarantee the loading screen always
  dismisses: the rehydrate callback fires on error too, the promise has a
  catch, and a 2-second timer marks hydrated regardless.
- **Mutations bump `updatedAt`** — `updatePlan()` is the single funnel
  for plan edits so the sync tiebreaker can never be forgotten.

Domain rules worth knowing:

- `startDay` also *finalizes* any unclosed past day (streak credit for a
  done big thing) and prunes plans past retention.
- Streaks count consecutive days where the big thing was done, tracked as
  `{count, lastWinDate}`. `currentStreak()` shows 0 once a day is missed.
- Deleting an inbox item (or promoting it into today) writes a tombstone
  so a sync from another device can't resurrect it.

## Sync: protocol and crypto

Design goal: multi-device sync with **no accounts** and a server that
**cannot read the data**.

### The pairing code

`generateSyncCode()` draws 32 Crockford-base32 characters (160 bits,
no I/L/O/U so it's unambiguous to read aloud). From the canonical code,
two values are derived with domain separation ([sync-crypto.ts](../src/lib/sync-crypto.ts)):

```
syncId  = hex( sha256("daybreak:sync-id:v1:"  + code) )   → sent to server
syncKey =      sha256("daybreak:sync-key:v1:" + code)     → never leaves device
```

The server knows only `syncId`. Hash preimage resistance means the id
can't be reversed into the code, and the id gives no access to the key.

### The blob

State is `JSON.stringify`-ed and sealed with **AES-256-GCM** under a
fresh 12-byte IV: `base64(iv ‖ ciphertext)`. GCM authenticates, so a
wrong key or a tampered blob throws instead of decoding garbage.

### The vault ([route.ts](../src/app/api/sync/route.ts))

A deliberately dumb versioned key-value store with three actions:

- `pull(id)` → `{version, data}`
- `push(id, version, data)` → OK if `version` matches the stored one
  (compare-and-swap via `UPDATE … WHERE version = ?`), else **409** with
  the current blob so the client can merge and retry without re-pulling.
- `delete(id)`

Input validation: 64-hex id, base64 data, 512 KB cap. Storage is libsql —
a local SQLite file by default, Turso when `SYNC_DB_URL` is set.

### The merge ([merge.ts](../src/lib/merge.ts))

Pure function, property-tested for idempotence and order-insensitivity:

- **Plans**: per date, higher `updatedAt` wins; ties break
  deterministically (JSON compare).
- **Inbox**: union by id, minus tombstoned ids; tombstones keep the
  newest timestamp.
- **Streak/settings** (singletons): higher `updatedAt` wins; on a *tie*,
  prefer meaningful content over empty defaults (this bit exists because
  migration-era epoch ties once let a fresh device erase the user name).
- Retention pruning happens inside the merge so syncing can't
  reintroduce aged-out data.

### The engine ([sync.ts](../src/lib/sync.ts))

`runSyncCycle`: pull → decrypt+validate → merge with local → apply if
changed → push with CAS → on 409, merge the conflict blob and retry
(bounded loop). Triggers: app open, 2.5 s debounce after any data
mutation, and tab-hide flush. An `applyingRemote` flag stops the engine
from reacting to its own writes. Status surfaces in `ui-store`
(`off/idle/syncing/error`) for the footer and dialog.

### Threat model, honestly stated

- The vault operator (or anyone who breaches it) sees ciphertext,
  timestamps, blob sizes, and write frequency — no plaintext.
- **Anyone with the pairing code has full read/write.** It's a bearer
  secret; treat like a password. Rotation = delete server copy + create
  a new code + re-link devices.
- Last-write-wins trusts device clocks; a badly skewed clock could win
  merges it shouldn't. Acceptable for a single-person app.
- Tombstones are pruned after retention; an unsynced device older than
  that could resurrect a deleted inbox item.

## Security headers and CSP nonces

[proxy.ts](../src/proxy.ts) runs on every page request (Next's proxy
convention, formerly middleware): it mints a nonce, builds the CSP
(`script-src 'self' 'nonce-…' 'strict-dynamic'` — **no `unsafe-inline`**
in production), and sets it on both request and response. Next.js reads
the request-header nonce and stamps every inline script it renders.
Consequence: the page must render dynamically (`connection()` in
[page.tsx](../src/app/page.tsx)); there is no static HTML because each
response embeds a fresh nonce.

Dev-only relaxations (`unsafe-eval` for Fast Refresh, `ws:` for HMR,
inline styles) are gated on `NODE_ENV`. Request-independent headers
(HSTS, nosniff, `X-Frame-Options: DENY`, Referrer/Permissions-Policy)
live in [next.config.ts](../next.config.ts). The service worker gets
`Cache-Control: no-cache` plus its own minimal CSP. There is deliberately
no `upgrade-insecure-requests` — it would break plain-http LAN access by
rewriting asset URLs to https.

## PWA and offline

- [manifest.ts](../src/app/manifest.ts) + generated icons make the app
  installable.
- [sw.js](../public/sw.js): navigations are **network-first** with the
  cached shell as offline fallback; hashed static assets are
  **stale-while-revalidate**. All user data is in localStorage, so the
  cached shell *is* the whole app offline.
- Registration is production-only (`ServiceWorkerRegistrar`) so dev hot
  reload never fights a cache.
- Escape hatch: [/reset.html](../public/reset.html) unregisters the
  worker and clears caches without touching user data. It's excluded
  from the CSP proxy because a static page can't carry a nonce.

## Testing

`npm test` runs 61 tests:

- `dates.test.ts` — date math, boundaries, greeting.
- `store.test.ts` — sanitization, caps, rollover, streak edge cases
  (reopen/re-close, gap reset, auto-finalize), v1→v2 migration.
- `merge.test.ts` — LWW both directions, tombstones, tie-breaking,
  idempotence/commutativity.
- `sync-crypto.test.ts` — code normalization, derivation, roundtrip,
  tamper rejection.
- `sync-engine.test.ts` — two devices converging through an in-memory
  vault, CAS conflict retry, wrong-key and invalid-payload failures.
- `app.test.tsx` / `palette.test.tsx` — component flows via Testing
  Library.

jsdom quirks handled in [vitest.setup.ts](../vitest.setup.ts):
localStorage polyfill (jsdom 29 dropped it) and node webcrypto exposure.

## Deployment topology

One app, two homes, one vault:

- **Local**: `next start -p 3200` on the Mac; other LAN devices reach it
  at `http://<hostname>.local:3200`.
- **Cloud**: Vercel project `daybreak`; `main` deploys production,
  `develop` deploys previews.
- Both point `SYNC_DB_URL`/`SYNC_DB_AUTH_TOKEN` at the same Turso
  database, so a device syncing via localhost and a phone syncing via
  the Vercel URL converge. (Unset, the server falls back to a local
  SQLite file — see [.env.example](../.env.example).)
