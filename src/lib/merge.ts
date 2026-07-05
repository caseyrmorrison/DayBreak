import { addDays } from "./dates";
import {
  LIMITS,
  type DayPlan,
  type InboxItem,
  type PersistedState,
} from "./schema";

// Record-level last-write-wins merge of two device states. Pure and
// symmetric apart from deterministic tie-breaking, so both devices
// converge on the same result regardless of merge order.
//
// Conflict model:
// - Plans are keyed by date and merged whole-plan by updatedAt.
// - Inbox items are immutable once created: union by id, minus
//   anything tombstoned in inboxDeletions (so deletes don't resurrect).
// - Streak and settings are single records merged by updatedAt.
// - Retention pruning (plans, tombstones) happens here too, so a sync
//   can never reintroduce data the user aged out.

function newerPlan(a: DayPlan, b: DayPlan): DayPlan {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

export function mergeStates(
  a: PersistedState,
  b: PersistedState,
  today: string,
): PersistedState {
  const cutoffDate = addDays(today, -LIMITS.planRetentionDays);
  const cutoffIso = `${cutoffDate}T00:00:00.000Z`;

  const plans: Record<string, DayPlan> = {};
  const allDates = [
    ...new Set([...Object.keys(a.plans), ...Object.keys(b.plans)]),
  ].sort();
  for (const date of allDates) {
    if (date < cutoffDate) continue;
    const pa = a.plans[date];
    const pb = b.plans[date];
    const winner = pa && pb ? newerPlan(pa, pb) : (pa ?? pb);
    if (winner) plans[date] = winner;
  }

  const inboxDeletions: Record<string, string> = {};
  for (const [id, ts] of [
    ...Object.entries(a.inboxDeletions),
    ...Object.entries(b.inboxDeletions),
  ]) {
    if (ts < cutoffIso) continue;
    const existing = inboxDeletions[id];
    if (!existing || existing < ts) inboxDeletions[id] = ts;
  }

  const inboxById = new Map<string, InboxItem>();
  for (const item of [...a.inbox, ...b.inbox]) {
    if (!inboxById.has(item.id)) inboxById.set(item.id, item);
  }
  const inbox = [...inboxById.values()]
    .filter((item) => !inboxDeletions[item.id])
    .sort(
      (x, y) => y.createdAt.localeCompare(x.createdAt) || x.id.localeCompare(y.id),
    )
    .slice(0, LIMITS.maxInboxItems);

  // Singleton records: last write wins, but on a timestamp tie (e.g.
  // both sides carry migration-era epoch stamps) prefer meaningful
  // content over an empty default, then break remaining ties
  // deterministically so both devices converge.
  const streak = (() => {
    if (a.streak.updatedAt !== b.streak.updatedAt) {
      return a.streak.updatedAt > b.streak.updatedAt ? a.streak : b.streak;
    }
    if (a.streak.count !== b.streak.count) {
      return a.streak.count > b.streak.count ? a.streak : b.streak;
    }
    return (a.streak.lastWinDate ?? "") >= (b.streak.lastWinDate ?? "")
      ? a.streak
      : b.streak;
  })();

  const settings = (() => {
    if (a.settings.updatedAt !== b.settings.updatedAt) {
      return a.settings.updatedAt > b.settings.updatedAt
        ? a.settings
        : b.settings;
    }
    if ((a.settings.name === null) !== (b.settings.name === null)) {
      return a.settings.name !== null ? a.settings : b.settings;
    }
    return (a.settings.name ?? "") >= (b.settings.name ?? "")
      ? a.settings
      : b.settings;
  })();

  return { plans, inbox, inboxDeletions, streak, settings };
}
