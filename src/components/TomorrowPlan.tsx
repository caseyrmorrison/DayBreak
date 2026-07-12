"use client";

import { Check, Lock, Sunrise } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays, formatDateKey } from "@/lib/dates";
import { preparedPlan, useDaybreak } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

// Shown in the closed-day state: either an invitation to plan tomorrow
// or a read-only preview of the plan already prepared. Read-only is the
// whole point — these tasks can't be started until their day arrives,
// at which point the plan simply becomes today's active plan.
export default function TomorrowPlan({ today }: { today: string }) {
  const plans = useDaybreak((s) => s.plans);
  const setPrepareOpen = useUi((s) => s.setPrepareOpen);

  const prepared = preparedPlan({ plans }, today);
  const openPrepare = () => setPrepareOpen(true);

  if (!prepared) {
    return (
      <section className="mt-4 rounded-2xl border border-border p-6">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Sunrise className="size-5" aria-hidden />
          Get a head start
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Plan tomorrow now, or leave it for the morning — whatever suits the
          night. Either way, you can&apos;t start these until the day begins.
        </p>
        <Button className="mt-4" onClick={openPrepare}>
          Plan tomorrow
        </Button>
      </section>
    );
  }

  const isTomorrow = prepared.date === addDays(today, 1);

  return (
    <section
      className="mt-4 rounded-2xl border border-border p-6"
      aria-label="Tomorrow's plan"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Ready for tomorrow</h2>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          Locked
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {isTomorrow
          ? formatDateKey(prepared.date)
          : `${formatDateKey(prepared.date)} — starts when that day arrives`}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {prepared.tasks.map((task, index) => (
          <li key={task.id} className="flex items-center gap-2 text-sm">
            <span
              className="size-4 shrink-0 rounded-full border border-muted-foreground/40"
              aria-hidden
            />
            <span
              className={cn(
                "min-w-0 truncate",
                index === 0 ? "font-medium" : "text-muted-foreground",
              )}
            >
              {task.title}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="size-3.5" aria-hidden />
        You&apos;ll be able to start these tomorrow morning.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={openPrepare}>
        Change
      </Button>
    </section>
  );
}
