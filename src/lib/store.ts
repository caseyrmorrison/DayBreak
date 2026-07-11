import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { addDays, isConsecutive } from "./dates";
import {
  EPOCH,
  LIMITS,
  persistedStateSchema,
  type DayPlan,
  type InboxItem,
  type PersistedState,
  type Streak,
  type Task,
} from "./schema";

export type TaskDraft = {
  title: string;
  note?: string;
  estimateMin?: number;
};

type DaybreakState = PersistedState & {
  hydrated: boolean;
  markHydrated: () => void;
  startDay: (date: string, drafts: TaskDraft[]) => boolean;
  toggleTask: (date: string, taskId: string) => void;
  removeTask: (date: string, taskId: string) => void;
  addToInbox: (text: string) => boolean;
  removeFromInbox: (id: string) => void;
  promoteInboxItem: (id: string, date: string) => boolean;
  closeDay: (date: string) => void;
  reopenDay: (date: string) => void;
  applyMergedState: (merged: PersistedState) => void;
};

const initialData: PersistedState = {
  plans: {},
  inbox: [],
  inboxDeletions: {},
  streak: { count: 0, lastWinDate: null, updatedAt: EPOCH },
};

function now(): string {
  return new Date().toISOString();
}

function sanitizeText(raw: string, max: number): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

function makeTask(draft: TaskDraft): Task | null {
  const title = sanitizeText(draft.title, LIMITS.taskTitle);
  if (!title) return null;
  const note = draft.note ? sanitizeText(draft.note, LIMITS.taskNote) : undefined;
  const estimateMin =
    draft.estimateMin !== undefined &&
    Number.isInteger(draft.estimateMin) &&
    draft.estimateMin > 0 &&
    draft.estimateMin <= LIMITS.maxEstimateMin
      ? draft.estimateMin
      : undefined;
  return {
    id: crypto.randomUUID(),
    title,
    ...(note ? { note } : {}),
    ...(estimateMin ? { estimateMin } : {}),
    done: false,
  };
}

function prunePlans(
  plans: Record<string, DayPlan>,
  today: string,
): Record<string, DayPlan> {
  const cutoff = addDays(today, -LIMITS.planRetentionDays);
  return Object.fromEntries(
    Object.entries(plans).filter(([date]) => date >= cutoff),
  );
}

function applyWin(streak: Streak, date: string): Streak {
  if (streak.lastWinDate === date) return streak;
  const count =
    streak.lastWinDate && isConsecutive(streak.lastWinDate, date)
      ? streak.count + 1
      : 1;
  return { count, lastWinDate: date, updatedAt: now() };
}

function finalizeOpenPastPlans(
  plans: Record<string, DayPlan>,
  streak: Streak,
  today: string,
): { plans: Record<string, DayPlan>; streak: Streak } {
  const pastOpen = Object.values(plans)
    .filter((p) => p.date < today && !p.shutdownAt)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (pastOpen.length === 0) return { plans, streak };
  const nextPlans = { ...plans };
  let nextStreak = streak;
  for (const plan of pastOpen) {
    nextPlans[plan.date] = {
      ...plan,
      shutdownAt: now(),
      updatedAt: now(),
    };
    if (plan.tasks[0]?.done) {
      nextStreak = applyWin(nextStreak, plan.date);
    }
  }
  return { plans: nextPlans, streak: nextStreak };
}

// Every plan mutation flows through here so updatedAt (the sync
// merge tiebreaker) can never be forgotten.
function updatePlan(
  state: DaybreakState,
  date: string,
  fn: (plan: DayPlan) => DayPlan,
): Partial<DaybreakState> {
  const plan = state.plans[date];
  if (!plan) return {};
  const next = fn(plan);
  if (next === plan) return {};
  return { plans: { ...state.plans, [date]: { ...next, updatedAt: now() } } };
}

// v1 predates sync: no updatedAt stamps, no tombstones. Stamp with
// EPOCH so anything written since always wins a merge against it.
// (The retired `settings` record needs no migration — zod strips it.)
export function migratePersistedState(
  persisted: unknown,
  version: number,
): unknown {
  if (version >= 2 || typeof persisted !== "object" || persisted === null) {
    return persisted;
  }
  const v1 = persisted as {
    plans?: Record<string, { date: string; tasks: Task[]; shutdownAt?: string }>;
    inbox?: InboxItem[];
    streak?: { count: number; lastWinDate: string | null };
  };
  return {
    plans: Object.fromEntries(
      Object.entries(v1.plans ?? {}).map(([date, plan]) => [
        date,
        { ...plan, updatedAt: EPOCH },
      ]),
    ),
    inbox: v1.inbox ?? [],
    inboxDeletions: {},
    streak: { ...(v1.streak ?? { count: 0, lastWinDate: null }), updatedAt: EPOCH },
  };
}

export const useDaybreak = create<DaybreakState>()(
  persist(
    (set, get) => ({
      ...initialData,
      hydrated: false,

      markHydrated: () => set({ hydrated: true }),

      startDay: (date, drafts) => {
        if (get().plans[date]) return false;
        const tasks = drafts
          .map(makeTask)
          .filter((t): t is Task => t !== null)
          .slice(0, LIMITS.maxTasksPerDay);
        if (tasks.length === 0) return false;
        set((s) => {
          const finalized = finalizeOpenPastPlans(s.plans, s.streak, date);
          return {
            plans: {
              ...prunePlans(finalized.plans, date),
              [date]: { date, tasks, updatedAt: now() },
            },
            streak: finalized.streak,
          };
        });
        return true;
      },

      toggleTask: (date, taskId) =>
        set((s) =>
          updatePlan(s, date, (plan) => ({
            ...plan,
            tasks: plan.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    done: !t.done,
                    ...(t.done
                      ? { completedAt: undefined }
                      : { completedAt: now() }),
                  }
                : t,
            ),
          })),
        ),

      removeTask: (date, taskId) =>
        set((s) =>
          updatePlan(s, date, (plan) => {
            const index = plan.tasks.findIndex((t) => t.id === taskId);
            if (index <= 0) return plan;
            return { ...plan, tasks: plan.tasks.filter((t) => t.id !== taskId) };
          }),
        ),

      addToInbox: (text) => {
        const clean = sanitizeText(text, LIMITS.inboxText);
        if (!clean) return false;
        const item: InboxItem = {
          id: crypto.randomUUID(),
          text: clean,
          createdAt: now(),
        };
        set((s) => ({
          inbox: [item, ...s.inbox].slice(0, LIMITS.maxInboxItems),
        }));
        return true;
      },

      removeFromInbox: (id) =>
        set((s) => ({
          inbox: s.inbox.filter((i) => i.id !== id),
          inboxDeletions: { ...s.inboxDeletions, [id]: now() },
        })),

      promoteInboxItem: (id, date) => {
        const s = get();
        const item = s.inbox.find((i) => i.id === id);
        const plan = s.plans[date];
        if (
          !item ||
          !plan ||
          plan.shutdownAt ||
          plan.tasks.length >= LIMITS.maxTasksPerDay
        ) {
          return false;
        }
        const task = makeTask({ title: item.text });
        if (!task) return false;
        set((st) => ({
          plans: {
            ...st.plans,
            [date]: { ...plan, tasks: [...plan.tasks, task], updatedAt: now() },
          },
          inbox: st.inbox.filter((i) => i.id !== id),
          inboxDeletions: { ...st.inboxDeletions, [id]: now() },
        }));
        return true;
      },

      closeDay: (date) => {
        const s = get();
        const plan = s.plans[date];
        if (!plan || plan.shutdownAt) return;
        const streak = plan.tasks[0]?.done ? applyWin(s.streak, date) : s.streak;
        set((st) => ({
          ...updatePlan(st, date, (p) => ({ ...p, shutdownAt: now() })),
          streak,
        }));
      },

      reopenDay: (date) =>
        set((s) =>
          updatePlan(s, date, (plan) => ({ ...plan, shutdownAt: undefined })),
        ),

      applyMergedState: (merged) =>
        set({
          plans: merged.plans,
          inbox: merged.inbox,
          inboxDeletions: merged.inboxDeletions,
          streak: merged.streak,
        }),
    }),
    {
      name: "daybreak.v1",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      migrate: migratePersistedState,
      partialize: (s) => ({
        plans: s.plans,
        inbox: s.inbox,
        inboxDeletions: s.inboxDeletions,
        streak: s.streak,
      }),
      merge: (persisted, current) => {
        const parsed = persistedStateSchema.safeParse(persisted);
        if (!parsed.success) return current;
        return { ...current, ...parsed.data };
      },
      // Always dismiss the loading screen: a failed hydration should
      // fall back to a fresh state, never an infinite "Loading…".
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Daybreak: hydration failed, starting fresh", error);
        }
        if (state) state.markHydrated();
        else useDaybreak.getState().markHydrated();
      },
    },
  ),
);

export function currentStreak(
  state: Pick<PersistedState, "streak">,
  today: string,
): number {
  const { count, lastWinDate } = state.streak;
  if (!lastWinDate) return 0;
  if (lastWinDate === today || isConsecutive(lastWinDate, today)) return count;
  return 0;
}

export function planHistory(
  state: Pick<PersistedState, "plans">,
  today: string,
): DayPlan[] {
  return Object.values(state.plans)
    .filter((p) => p.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function rolloverSuggestions(
  state: Pick<PersistedState, "plans">,
  today: string,
): string[] {
  const pastDates = Object.keys(state.plans)
    .filter((d) => d < today)
    .sort();
  const latest = pastDates[pastDates.length - 1];
  if (!latest) return [];
  const plan = state.plans[latest];
  return plan.tasks.filter((t) => !t.done).map((t) => t.title);
}
