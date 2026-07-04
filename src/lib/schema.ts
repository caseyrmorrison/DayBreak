import { z } from "zod";
import { isDateKey } from "./dates";

export const LIMITS = {
  taskTitle: 200,
  taskNote: 280,
  inboxText: 500,
  name: 40,
  maxTasksPerDay: 3,
  maxInboxItems: 200,
  maxEstimateMin: 480,
  planRetentionDays: 30,
} as const;

const dateKeySchema = z.string().refine(isDateKey, "invalid date key");
const idSchema = z.string().min(8).max(64);
const isoSchema = z.string().min(10).max(40);

export const taskSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(LIMITS.taskTitle),
  note: z.string().max(LIMITS.taskNote).optional(),
  estimateMin: z.number().int().positive().max(LIMITS.maxEstimateMin).optional(),
  done: z.boolean(),
  completedAt: isoSchema.optional(),
});

export const dayPlanSchema = z.object({
  date: dateKeySchema,
  tasks: z.array(taskSchema).min(1).max(LIMITS.maxTasksPerDay),
  shutdownAt: isoSchema.optional(),
});

export const inboxItemSchema = z.object({
  id: idSchema,
  text: z.string().min(1).max(LIMITS.inboxText),
  createdAt: isoSchema,
});

export const persistedStateSchema = z.object({
  plans: z.record(dateKeySchema, dayPlanSchema),
  inbox: z.array(inboxItemSchema).max(LIMITS.maxInboxItems),
  streak: z.object({
    count: z.number().int().nonnegative(),
    lastWinDate: dateKeySchema.nullable(),
  }),
  settings: z.object({
    name: z.string().max(LIMITS.name).nullable(),
  }),
});

export type Task = z.infer<typeof taskSchema>;
export type DayPlan = z.infer<typeof dayPlanSchema>;
export type InboxItem = z.infer<typeof inboxItemSchema>;
export type PersistedState = z.infer<typeof persistedStateSchema>;
export type Streak = PersistedState["streak"];
