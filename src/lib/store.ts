import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { addDays, isConsecutive } from "./dates";
import {
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
  setName: (name: string) => void;
};

const initialData: PersistedState = {
  plans: {},
  inbox: [],
  streak: { count: 0, lastWinDate: null },
  settings: { name: null },
};

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
  return { count, lastWinDate: date };
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
    nextPlans[plan.date] = { ...plan, shutdownAt: new Date().toISOString() };
    if (plan.tasks[0]?.done) {
      nextStreak = applyWin(nextStreak, plan.date);
    }
  }
  return { plans: nextPlans, streak: nextStreak };
}

function updatePlan(
  state: DaybreakState,
  date: string,
  fn: (plan: DayPlan) => DayPlan,
): Partial<DaybreakState> {
  const plan = state.plans[date];
  if (!plan) return {};
  return { plans: { ...state.plans, [date]: fn(plan) } };
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
              [date]: { date, tasks },
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
                      : { completedAt: new Date().toISOString() }),
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
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          inbox: [item, ...s.inbox].slice(0, LIMITS.maxInboxItems),
        }));
        return true;
      },

      removeFromInbox: (id) =>
        set((s) => ({ inbox: s.inbox.filter((i) => i.id !== id) })),

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
            [date]: { ...plan, tasks: [...plan.tasks, task] },
          },
          inbox: st.inbox.filter((i) => i.id !== id),
        }));
        return true;
      },

      closeDay: (date) => {
        const s = get();
        const plan = s.plans[date];
        if (!plan || plan.shutdownAt) return;
        const streak = plan.tasks[0]?.done ? applyWin(s.streak, date) : s.streak;
        set((st) => ({
          ...updatePlan(st, date, (p) => ({
            ...p,
            shutdownAt: new Date().toISOString(),
          })),
          streak,
        }));
      },

      reopenDay: (date) =>
        set((s) =>
          updatePlan(s, date, (plan) => ({ ...plan, shutdownAt: undefined })),
        ),

      setName: (name) => {
        const clean = sanitizeText(name, LIMITS.name);
        set({ settings: { name: clean || null } });
      },
    }),
    {
      name: "daybreak.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        plans: s.plans,
        inbox: s.inbox,
        streak: s.streak,
        settings: s.settings,
      }),
      merge: (persisted, current) => {
        const parsed = persistedStateSchema.safeParse(persisted);
        if (!parsed.success) return current;
        return { ...current, ...parsed.data };
      },
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
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
