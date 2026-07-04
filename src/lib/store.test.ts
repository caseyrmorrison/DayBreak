import { beforeEach, describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { LIMITS, persistedStateSchema } from "./schema";
import { currentStreak, rolloverSuggestions, useDaybreak } from "./store";

const TODAY = "2026-07-04";
const YESTERDAY = "2026-07-03";

beforeEach(() => {
  localStorage.clear();
  useDaybreak.setState({
    plans: {},
    inbox: [],
    streak: { count: 0, lastWinDate: null },
    settings: { name: null },
  });
});

describe("startDay", () => {
  it("creates a plan with sanitized tasks", () => {
    const ok = useDaybreak
      .getState()
      .startDay(TODAY, [{ title: "  Ship   the login flow  " }]);
    expect(ok).toBe(true);
    const plan = useDaybreak.getState().plans[TODAY];
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].title).toBe("Ship the login flow");
    expect(plan.tasks[0].done).toBe(false);
  });

  it("rejects a day with no valid tasks", () => {
    expect(useDaybreak.getState().startDay(TODAY, [{ title: "   " }])).toBe(
      false,
    );
    expect(useDaybreak.getState().plans[TODAY]).toBeUndefined();
  });

  it("caps tasks at the daily limit and titles at max length", () => {
    const drafts = ["a", "b", "c", "d"].map((t) => ({
      title: t + "x".repeat(300),
    }));
    useDaybreak.getState().startDay(TODAY, drafts);
    const plan = useDaybreak.getState().plans[TODAY];
    expect(plan.tasks).toHaveLength(LIMITS.maxTasksPerDay);
    expect(plan.tasks[0].title).toHaveLength(LIMITS.taskTitle);
  });

  it("does not overwrite an existing plan", () => {
    useDaybreak.getState().startDay(TODAY, [{ title: "first" }]);
    expect(useDaybreak.getState().startDay(TODAY, [{ title: "second" }])).toBe(
      false,
    );
    expect(useDaybreak.getState().plans[TODAY].tasks[0].title).toBe("first");
  });

  it("drops an invalid estimate but keeps a valid one", () => {
    useDaybreak.getState().startDay(TODAY, [
      { title: "big", estimateMin: 90 },
      { title: "weird", estimateMin: 100000 },
    ]);
    const plan = useDaybreak.getState().plans[TODAY];
    expect(plan.tasks[0].estimateMin).toBe(90);
    expect(plan.tasks[1].estimateMin).toBeUndefined();
  });

  it("prunes plans older than the retention window", () => {
    const ancient = addDays(TODAY, -(LIMITS.planRetentionDays + 10));
    useDaybreak.getState().startDay(ancient, [{ title: "old" }]);
    useDaybreak.getState().closeDay(ancient);
    useDaybreak.getState().startDay(TODAY, [{ title: "new" }]);
    expect(useDaybreak.getState().plans[ancient]).toBeUndefined();
    expect(useDaybreak.getState().plans[TODAY]).toBeDefined();
  });

  it("finalizes an unclosed winning yesterday when today starts", () => {
    const s = useDaybreak.getState();
    s.startDay(YESTERDAY, [{ title: "big thing" }]);
    const id = useDaybreak.getState().plans[YESTERDAY].tasks[0].id;
    s.toggleTask(YESTERDAY, id);
    s.startDay(TODAY, [{ title: "next big thing" }]);
    const state = useDaybreak.getState();
    expect(state.plans[YESTERDAY].shutdownAt).toBeDefined();
    expect(state.streak).toEqual({ count: 1, lastWinDate: YESTERDAY });
  });
});

describe("toggleTask", () => {
  it("marks done with a timestamp and back again", () => {
    useDaybreak.getState().startDay(TODAY, [{ title: "big" }]);
    const id = useDaybreak.getState().plans[TODAY].tasks[0].id;
    useDaybreak.getState().toggleTask(TODAY, id);
    expect(useDaybreak.getState().plans[TODAY].tasks[0].done).toBe(true);
    expect(useDaybreak.getState().plans[TODAY].tasks[0].completedAt).toBeDefined();
    useDaybreak.getState().toggleTask(TODAY, id);
    expect(useDaybreak.getState().plans[TODAY].tasks[0].done).toBe(false);
    expect(
      useDaybreak.getState().plans[TODAY].tasks[0].completedAt,
    ).toBeUndefined();
  });
});

describe("removeTask", () => {
  it("removes backup tasks but never the big thing", () => {
    useDaybreak
      .getState()
      .startDay(TODAY, [{ title: "big" }, { title: "backup" }]);
    const [big, backup] = useDaybreak.getState().plans[TODAY].tasks;
    useDaybreak.getState().removeTask(TODAY, big.id);
    expect(useDaybreak.getState().plans[TODAY].tasks).toHaveLength(2);
    useDaybreak.getState().removeTask(TODAY, backup.id);
    expect(useDaybreak.getState().plans[TODAY].tasks).toHaveLength(1);
    expect(useDaybreak.getState().plans[TODAY].tasks[0].id).toBe(big.id);
  });
});

describe("inbox", () => {
  it("rejects empty input and truncates long input", () => {
    expect(useDaybreak.getState().addToInbox("   ")).toBe(false);
    expect(useDaybreak.getState().addToInbox("y".repeat(600))).toBe(true);
    expect(useDaybreak.getState().inbox[0].text).toHaveLength(
      LIMITS.inboxText,
    );
  });

  it("caps the number of items", () => {
    for (let i = 0; i < LIMITS.maxInboxItems + 5; i++) {
      useDaybreak.getState().addToInbox(`thought ${i}`);
    }
    expect(useDaybreak.getState().inbox).toHaveLength(LIMITS.maxInboxItems);
  });

  it("promotes an item into today's plan and consumes it", () => {
    useDaybreak.getState().startDay(TODAY, [{ title: "big" }]);
    useDaybreak.getState().addToInbox("look into RISC-V toolchain");
    const item = useDaybreak.getState().inbox[0];
    expect(useDaybreak.getState().promoteInboxItem(item.id, TODAY)).toBe(true);
    const state = useDaybreak.getState();
    expect(state.plans[TODAY].tasks).toHaveLength(2);
    expect(state.plans[TODAY].tasks[1].title).toBe(
      "look into RISC-V toolchain",
    );
    expect(state.inbox).toHaveLength(0);
  });

  it("refuses to promote into a full or closed day", () => {
    useDaybreak
      .getState()
      .startDay(TODAY, [{ title: "a" }, { title: "b" }, { title: "c" }]);
    useDaybreak.getState().addToInbox("overflow");
    const item = useDaybreak.getState().inbox[0];
    expect(useDaybreak.getState().promoteInboxItem(item.id, TODAY)).toBe(false);
    expect(useDaybreak.getState().inbox).toHaveLength(1);
  });
});

describe("closeDay and streaks", () => {
  function winDay(date: string) {
    useDaybreak.getState().startDay(date, [{ title: "big" }]);
    const id = useDaybreak.getState().plans[date].tasks[0].id;
    useDaybreak.getState().toggleTask(date, id);
    useDaybreak.getState().closeDay(date);
  }

  it("starts a streak on a win", () => {
    winDay(TODAY);
    expect(useDaybreak.getState().streak).toEqual({
      count: 1,
      lastWinDate: TODAY,
    });
  });

  it("increments across consecutive wins and resets after a gap", () => {
    winDay("2026-06-29");
    winDay("2026-06-30");
    expect(useDaybreak.getState().streak.count).toBe(2);
    winDay(TODAY);
    expect(useDaybreak.getState().streak).toEqual({
      count: 1,
      lastWinDate: TODAY,
    });
  });

  it("does not double-count when a day is reopened and closed again", () => {
    winDay(TODAY);
    useDaybreak.getState().reopenDay(TODAY);
    useDaybreak.getState().closeDay(TODAY);
    expect(useDaybreak.getState().streak.count).toBe(1);
  });

  it("leaves the streak alone when the big thing was not done", () => {
    useDaybreak.getState().startDay(TODAY, [{ title: "big" }]);
    useDaybreak.getState().closeDay(TODAY);
    expect(useDaybreak.getState().streak.count).toBe(0);
  });
});

describe("currentStreak", () => {
  it("shows the count while the streak is alive and 0 once it lapses", () => {
    const streak = { count: 3, lastWinDate: YESTERDAY };
    expect(currentStreak({ streak }, TODAY)).toBe(3);
    expect(currentStreak({ streak }, "2026-07-06")).toBe(0);
    expect(
      currentStreak({ streak: { count: 0, lastWinDate: null } }, TODAY),
    ).toBe(0);
  });
});

describe("rolloverSuggestions", () => {
  it("returns unfinished tasks from the most recent past plan only", () => {
    useDaybreak
      .getState()
      .startDay("2026-07-01", [{ title: "stale" }]);
    useDaybreak
      .getState()
      .startDay(YESTERDAY, [{ title: "finished" }, { title: "unfinished" }]);
    const done = useDaybreak.getState().plans[YESTERDAY].tasks[0].id;
    useDaybreak.getState().toggleTask(YESTERDAY, done);
    expect(rolloverSuggestions(useDaybreak.getState(), TODAY)).toEqual([
      "unfinished",
    ]);
    expect(rolloverSuggestions(useDaybreak.getState(), "2026-07-01")).toEqual(
      [],
    );
  });
});

describe("persisted state validation", () => {
  it("accepts a valid state roundtrip", () => {
    useDaybreak.getState().startDay(TODAY, [{ title: "big" }]);
    useDaybreak.getState().addToInbox("a thought");
    const { plans, inbox, streak, settings } = useDaybreak.getState();
    expect(
      persistedStateSchema.safeParse({ plans, inbox, streak, settings })
        .success,
    ).toBe(true);
  });

  it("rejects tampered or corrupt data", () => {
    expect(persistedStateSchema.safeParse({ plans: "nope" }).success).toBe(
      false,
    );
    expect(
      persistedStateSchema.safeParse({
        plans: {},
        inbox: [{ id: "x", text: "", createdAt: "now" }],
        streak: { count: -1, lastWinDate: null },
        settings: { name: null },
      }).success,
    ).toBe(false);
  });
});
