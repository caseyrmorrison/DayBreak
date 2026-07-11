import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { mergeStates } from "./merge";
import { EPOCH, type DayPlan, type PersistedState } from "./schema";
import { baseState } from "./test-helpers";

const TODAY = "2026-07-04";

function plan(date: string, title: string, updatedAt: string, done = false): DayPlan {
  return {
    date,
    tasks: [{ id: `task-${title}-${date}`, title, done }],
    updatedAt,
  };
}

function state(partial: Partial<PersistedState>): PersistedState {
  return { ...baseState(), ...partial };
}

describe("mergeStates plans", () => {
  it("unions plans from both sides", () => {
    const a = state({ plans: { "2026-07-03": plan("2026-07-03", "a", EPOCH) } });
    const b = state({ plans: { [TODAY]: plan(TODAY, "b", EPOCH) } });
    const merged = mergeStates(a, b, TODAY);
    expect(Object.keys(merged.plans).sort()).toEqual(["2026-07-03", TODAY]);
  });

  it("picks the newer plan for the same date, in either order", () => {
    const older = plan(TODAY, "older", "2026-07-04T08:00:00.000Z");
    const newer = plan(TODAY, "newer", "2026-07-04T09:00:00.000Z");
    const a = state({ plans: { [TODAY]: older } });
    const b = state({ plans: { [TODAY]: newer } });
    expect(mergeStates(a, b, TODAY).plans[TODAY].tasks[0].title).toBe("newer");
    expect(mergeStates(b, a, TODAY).plans[TODAY].tasks[0].title).toBe("newer");
  });

  it("breaks timestamp ties deterministically", () => {
    const x = plan(TODAY, "xxx", "2026-07-04T08:00:00.000Z");
    const y = plan(TODAY, "yyy", "2026-07-04T08:00:00.000Z");
    const one = mergeStates(
      state({ plans: { [TODAY]: x } }),
      state({ plans: { [TODAY]: y } }),
      TODAY,
    );
    const two = mergeStates(
      state({ plans: { [TODAY]: y } }),
      state({ plans: { [TODAY]: x } }),
      TODAY,
    );
    expect(one.plans[TODAY]).toEqual(two.plans[TODAY]);
  });

  it("prunes plans past the retention window", () => {
    const ancient = addDays(TODAY, -45);
    const a = state({ plans: { [ancient]: plan(ancient, "old", EPOCH) } });
    expect(mergeStates(a, baseState(), TODAY).plans[ancient]).toBeUndefined();
  });
});

describe("mergeStates inbox", () => {
  const item = (id: string, text: string, createdAt: string) => ({
    id: `${id}-padded-id`,
    text,
    createdAt,
  });

  it("unions items and does not resurrect deleted ones", () => {
    const shared = item("shared", "keep me", "2026-07-04T08:00:00.000Z");
    const deleted = item("gone", "delete me", "2026-07-04T07:00:00.000Z");
    const a = state({ inbox: [shared, deleted] });
    const b = state({
      inbox: [shared],
      inboxDeletions: { [deleted.id]: "2026-07-04T09:00:00.000Z" },
    });
    const merged = mergeStates(a, b, TODAY);
    expect(merged.inbox.map((i) => i.text)).toEqual(["keep me"]);
    expect(merged.inboxDeletions[deleted.id]).toBeDefined();
    const reversed = mergeStates(b, a, TODAY);
    expect(reversed.inbox.map((i) => i.text)).toEqual(["keep me"]);
  });

  it("keeps distinct items from both devices sorted newest first", () => {
    const a = state({ inbox: [item("a", "from a", "2026-07-04T08:00:00.000Z")] });
    const b = state({ inbox: [item("b", "from b", "2026-07-04T09:00:00.000Z")] });
    expect(mergeStates(a, b, TODAY).inbox.map((i) => i.text)).toEqual([
      "from b",
      "from a",
    ]);
  });

  it("prunes tombstones older than the retention window", () => {
    const a = state({
      inboxDeletions: {
        "old-tombstone-id": "2026-05-01T00:00:00.000Z",
        "new-tombstone-id": "2026-07-03T00:00:00.000Z",
      },
    });
    const merged = mergeStates(a, baseState(), TODAY);
    expect(merged.inboxDeletions["old-tombstone-id"]).toBeUndefined();
    expect(merged.inboxDeletions["new-tombstone-id"]).toBeDefined();
  });
});

describe("mergeStates streak", () => {
  it("prefers real content over empty defaults on a timestamp tie", () => {
    const migrated = state({
      streak: { count: 4, lastWinDate: "2026-07-03", updatedAt: EPOCH },
    });
    const fresh = baseState();
    for (const [x, y] of [
      [migrated, fresh],
      [fresh, migrated],
    ] as const) {
      const merged = mergeStates(x, y, TODAY);
      expect(merged.streak.count).toBe(4);
    }
  });

  it("last write wins for the streak", () => {
    const a = state({
      streak: { count: 3, lastWinDate: "2026-07-03", updatedAt: "2026-07-03T20:00:00.000Z" },
    });
    const b = state({
      streak: { count: 1, lastWinDate: "2026-07-01", updatedAt: "2026-07-01T20:00:00.000Z" },
    });
    const merged = mergeStates(a, b, TODAY);
    expect(merged.streak.count).toBe(3);
    expect(mergeStates(b, a, TODAY).streak.count).toBe(3);
  });
});

describe("mergeStates convergence", () => {
  it("is idempotent and order-insensitive", () => {
    const a = state({
      plans: { [TODAY]: plan(TODAY, "a", "2026-07-04T08:00:00.000Z", true) },
      inbox: [{ id: "item-from-a-1", text: "alpha", createdAt: "2026-07-04T06:00:00.000Z" }],
    });
    const b = state({
      plans: { "2026-07-03": plan("2026-07-03", "b", "2026-07-03T08:00:00.000Z") },
      inboxDeletions: { "item-from-a-1": "2026-07-04T10:00:00.000Z" },
    });
    const ab = mergeStates(a, b, TODAY);
    const ba = mergeStates(b, a, TODAY);
    expect(ab).toEqual(ba);
    expect(mergeStates(ab, a, TODAY)).toEqual(ab);
    expect(mergeStates(ab, ab, TODAY)).toEqual(ab);
  });
});
