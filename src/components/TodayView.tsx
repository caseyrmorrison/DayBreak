"use client";

import { Cloud, CloudAlert, Flame, Play, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { formatDateKey, greetingFor } from "@/lib/dates";
import { currentStreak, useDaybreak } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import BrainDump from "./BrainDump";
import FocusOverlay from "./FocusOverlay";
import InboxSheet from "./InboxSheet";
import ShutdownDialog from "./ShutdownDialog";
import TaskRow from "./TaskRow";

export default function TodayView({ today }: { today: string }) {
  const plan = useDaybreak((s) => s.plans[today]);
  const name = useDaybreak((s) => s.settings.name);
  const streakState = useDaybreak((s) => s.streak);
  const toggleTask = useDaybreak((s) => s.toggleTask);
  const removeTask = useDaybreak((s) => s.removeTask);
  const reopenDay = useDaybreak((s) => s.reopenDay);
  const focusId = useUi((s) => s.focusTaskId);
  const setFocusId = useUi((s) => s.setFocusTask);
  const setSyncDialogOpen = useUi((s) => s.setSyncDialogOpen);
  const syncStatus = useUi((s) => s.syncStatus);

  if (!plan) return null;

  const [bigThing, ...backups] = plan.tasks;
  const doneCount = plan.tasks.filter((t) => t.done).length;
  const allDone = doneCount === plan.tasks.length;
  const streak = currentStreak({ streak: streakState }, today);
  const closed = Boolean(plan.shutdownAt);
  const focusTask = plan.tasks.find((t) => t.id === focusId) ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <header>
        <p className="text-sm text-muted-foreground">{formatDateKey(today)}</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">
          {greetingFor(new Date().getHours())}
          {name ? `, ${name}` : ""}
        </h1>
      </header>

      {closed ? (
        <section className="mt-12 rounded-2xl border border-border p-6">
          <h2 className="text-lg font-medium">
            {bigThing.done ? "Day won." : "Day closed."}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {doneCount} of {plan.tasks.length} done.
            {doneCount < plan.tasks.length
              ? " Unfinished tasks will be suggested tomorrow."
              : " See you tomorrow morning."}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => reopenDay(today)}
          >
            Reopen the day
          </Button>
        </section>
      ) : (
        <>
          <section aria-label="Your one big thing" className="mt-10">
            <p className="text-sm text-muted-foreground">Your one big thing</p>
            <div className="mt-2 rounded-2xl border border-border p-5">
              <TaskRow
                task={bigThing}
                big
                onToggle={() => toggleTask(today, bigThing.id)}
                trailing={
                  !bigThing.done ? (
                    <Button size="sm" onClick={() => setFocusId(bigThing.id)}>
                      <Play aria-hidden />
                      Start
                    </Button>
                  ) : undefined
                }
              />
              {(bigThing.note || bigThing.estimateMin) && (
                <p className="mt-2 pl-10 text-sm text-muted-foreground">
                  {[
                    bigThing.estimateMin
                      ? `About ${bigThing.estimateMin} min`
                      : null,
                    bigThing.note,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </section>

          {backups.length > 0 && (
            <section aria-label="Backup tasks" className="mt-8">
              <p className="text-sm text-muted-foreground">Then, in order</p>
              <ul className="mt-1 divide-y divide-border">
                {backups.map((task) => (
                  <li key={task.id} className="flex items-center py-3">
                    <TaskRow
                      task={task}
                      onToggle={() => toggleTask(today, task.id)}
                      trailing={
                        <span className="flex items-center gap-1">
                          {!task.done && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Focus on "${task.title}"`}
                              onClick={() => setFocusId(task.id)}
                            >
                              <Play aria-hidden />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove "${task.title}"`}
                            onClick={() => removeTask(today, task.id)}
                          >
                            <X aria-hidden />
                          </Button>
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <AnimatePresence>
            {allDone && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-8 text-sm font-medium"
              >
                That&apos;s everything — you won the day. Close it out whenever
                you&apos;re ready.
              </motion.p>
            )}
          </AnimatePresence>
        </>
      )}

      <div className="mt-auto pt-12">
        <BrainDump />
        <footer className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-5 text-sm text-muted-foreground">
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Flame className="size-4" aria-hidden />
              {streak > 0 ? `${streak}-day streak` : "No streak yet"}
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">
                ⌘K
              </kbd>
              capture
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSyncDialogOpen(true)}
            >
              {syncStatus === "error" ? (
                <CloudAlert aria-hidden />
              ) : (
                <Cloud aria-hidden />
              )}
              {syncStatus === "off"
                ? "Sync"
                : syncStatus === "syncing"
                  ? "Syncing…"
                  : syncStatus === "error"
                    ? "Sync issue"
                    : "Synced"}
            </Button>
            <InboxSheet today={today} />
            {!closed && <ShutdownDialog today={today} />}
          </span>
        </footer>
      </div>

      <AnimatePresence>
        {focusTask && !closed && (
          <FocusOverlay
            task={focusTask}
            onDone={() => {
              toggleTask(today, focusTask.id);
              setFocusId(null);
            }}
            onClose={() => setFocusId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
