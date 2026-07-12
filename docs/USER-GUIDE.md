# Using Daybreak

Daybreak is built around one belief: the hard part of a day isn't doing
the work, it's deciding where to start. So the app asks you to decide
once, first thing, and then gets out of the way.

## Morning: plan the day (2 minutes)

Open the app. It asks one question:

> **What's the one thing that would make today a win?**

Type it. That's your **big thing** — the task that, if it's the only
thing you finish, still made the day count. Optionally:

- Tap an **estimate** chip (25/50/90 min). The focus timer uses it.
- Add **why it matters** — one line shown under the task all day, for
  the moment your motivation dips.
- Add up to **two backup tasks** for "then, if there's time."

Below the form you'll see **suggestion chips**: unfinished tasks from
yesterday and recent thoughts from your inbox. Tap one to fill a slot
instead of retyping.

Hit **Start the day**. The cap of three tasks is deliberate — the point
is choosing, not listing. Everything else belongs in the inbox.

## During the day: focus and capture

Your big thing sits at the top with a **Start** button. Press it and the
screen becomes just that task and a timer — pause it, finish with
**Done** (which checks the task off), or step back with Esc. If you set
an estimate, the timer nudges you when you pass it.

When a distracting thought lands mid-work — "I should compare hosting
prices", "buy cat food" — don't act on it. Press **⌘K** (or Ctrl+K),
type it, hit Enter. It's captured to your **inbox** and you're back in
two seconds. The box at the bottom of the main screen does the same.

The palette is also the fast lane for actions: type to filter "Start
focus", "Mark done", "Close the day", "Sync now".

**The inbox** (footer) is where captured thoughts wait. When you have a
free moment: promote one into today with **+** (if a slot is free) or
delete it. Many thoughts age into irrelevance — that's the feature.

## Evening: close the day (1 minute)

Press **Close the day** in the footer. The dialog shows what got done
and what rolls into tomorrow's suggestions. Confirm, and the day is
sealed — finish your big thing and your **streak** grows; the flame in
the footer tracks consecutive wins.

Forgot to close? No punishment: tomorrow's kickoff finalizes yesterday
automatically, streak credit included. Closed too early? **Reopen the
day** brings it back.

## Planning the next day

Some nights you want to line up tomorrow before bed; some mornings you'd
rather decide fresh. Daybreak supports both. Once you **close the day**,
a "Plan tomorrow" card appears — or reach it any time from ⌘K → "Plan
tomorrow". It's the same one-big-thing form, aimed at tomorrow.

The catch, by design: a plan you make for tomorrow is **locked**. It
shows as a read-only preview ("Ready for tomorrow") with no way to start
or check anything off — you can't get ahead of yourself. When tomorrow
actually arrives, that plan quietly becomes your active day, fully
startable, right where you left it. Prefer to plan in the morning
instead? Just don't — open the app tomorrow and the normal kickoff is
waiting. Change your mind about a prepared plan? **Change** re-opens it
with your tasks filled in.

Want to see what you've done? **Tap the streak** in the footer (or
⌘K → "Show history") for a read-only view of the last 30 days — each
day's tasks and whether its big thing shipped. Days age out after 30;
history is for glancing, not managing.

## Sync across your devices

Daybreak has no accounts. Devices link with a **pairing code** that is
also the encryption key — the server only ever stores ciphertext it
cannot read.

- **First device**: footer → **Sync** → **Create a sync code**. Copy it
  somewhere safe (password manager is ideal).
- **Every other device**: open the app → **"Have Daybreak on another
  device? Set up sync"** (or footer → Sync) → paste the code → **Link**.
  Your day appears in a second or two.

Syncing is automatic — shortly after changes, when you switch away, and
on open. The footer shows the state (Synced / Syncing… / Sync issue).

Rules of the code: anyone who has it can read and write your data, and
if you lose it the server copy is unrecoverable (that's the privacy
guarantee working as intended — your devices still hold everything).
To **rotate** it: Sync → Delete server copy → Create a sync code →
re-link your other devices with the new one.

Because each device keeps a full local copy, everything works offline;
changes merge sensibly when you're back (last edit wins per task-day,
deletions stay deleted).

## Install it like a real app

- **Desktop Chrome/Edge**: install icon at the right end of the address
  bar → Daybreak gets its own window and dock icon.
- **Safari (Mac)**: File → Add to Dock.
- **iPhone/iPad**: open the production URL in Safari → Share → **Add to
  Home Screen**. (Requires the https Vercel URL, not the LAN address.)
- It keeps working with no connection — data loads from the device, and
  sync catches up later.

## When something looks wrong

- **Stuck on "Loading your day…"**: reload once; if it persists, go to
  `/reset.html` on the same host — it clears cached app files and the
  service worker, then returns you to the app. Your data is untouched.
- **"Sync issue" in the footer**: open the Sync dialog to see why —
  almost always the server was briefly unreachable. **Sync now** retries.
- **A day on the wrong date**: days roll at your device's local
  midnight; check its clock/timezone.
- **Want a clean slate on one browser**: clear the site's data in your
  browser settings. Other devices and the vault are unaffected — re-link
  with your code to pull everything back, or delete the server copy
  first if you want the slate clean everywhere.

## The method, in one paragraph

Pick one thing each morning (Ivy Lee's constraint, "eat the frog"'s
ordering). Guard it with a focus timer. Catch every stray thought in an
inbox instead of chasing it. Close the day deliberately so your brain
can stop (Cal Newport's shutdown ritual), and let the streak make
showing up tomorrow slightly easier than not. Daybreak is just these
five habits with a UI.
