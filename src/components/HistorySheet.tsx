"use client";

import { Check, Flame } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateKey } from "@/lib/dates";
import { planHistory, useDaybreak } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

// Read-only window onto data the app already keeps: the last 30 days
// of plans. Deliberately no interactions — history is for glancing,
// not managing.
export default function HistorySheet({ today }: { today: string }) {
  const open = useUi((s) => s.historyOpen);
  const setOpen = useUi((s) => s.setHistoryOpen);
  const plans = useDaybreak((s) => s.plans);

  const history = planHistory({ plans }, today);
  const wins = history.filter((p) => p.tasks[0]?.done).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>History</DialogTitle>
          <DialogDescription>
            {history.length === 0
              ? "Past days will show up here once you've planned one."
              : `Big thing done on ${wins} of the last ${history.length} ${
                  history.length === 1 ? "day" : "days"
                }. Days age out after 30.`}
          </DialogDescription>
        </DialogHeader>
        {history.length > 0 && (
          <ul className="flex max-h-96 flex-col overflow-y-auto">
            {history.map((plan) => (
              <li
                key={plan.date}
                className="border-b border-border py-3 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {formatDateKey(plan.date)}
                  </p>
                  {plan.tasks[0]?.done && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Flame className="size-3.5" aria-hidden />
                      Won
                    </span>
                  )}
                </div>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {plan.tasks.map((task, index) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      {task.done ? (
                        <Check className="size-3.5 shrink-0" aria-hidden />
                      ) : (
                        <span
                          className="size-3.5 shrink-0 rounded-full border border-muted-foreground/40"
                          aria-hidden
                        />
                      )}
                      <span className="sr-only">
                        {task.done ? "Done:" : "Not done:"}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 truncate",
                          (index > 0 || !task.done) && "text-muted-foreground",
                        )}
                      >
                        {task.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
