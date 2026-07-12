"use client";

import { Moon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDaybreak } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function ShutdownDialog({ today }: { today: string }) {
  const plan = useDaybreak((s) => s.plans[today]);
  const closeDay = useDaybreak((s) => s.closeDay);

  if (!plan) return null;

  const doneCount = plan.tasks.filter((t) => t.done).length;
  const unfinished = plan.tasks.filter((t) => !t.done);
  const bigDone = plan.tasks[0].done;

  return (
    <Dialog>
      <DialogTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        aria-label="Close the day"
      >
        <Moon aria-hidden />
        <span className="hidden sm:inline">Close the day</span>
        <span className="sm:hidden">Close</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {bigDone ? "Close out a good day" : "Close the day"}
          </DialogTitle>
          <DialogDescription>
            {doneCount} of {plan.tasks.length} done
            {bigDone ? ", including your big thing." : "."}
          </DialogDescription>
        </DialogHeader>
        {unfinished.length > 0 && (
          <div className="text-sm">
            <p className="text-muted-foreground">
              These roll over into tomorrow&apos;s suggestions:
            </p>
            <ul className="mt-2 list-disc pl-5">
              {unfinished.map((t) => (
                <li key={t.id}>{t.title}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Once it&apos;s closed, you can plan tomorrow — or leave it for the
          morning.
        </p>
        <DialogFooter>
          <DialogClose className={cn(buttonVariants({ variant: "outline" }))}>
            Keep going
          </DialogClose>
          <DialogClose
            className={cn(buttonVariants({ variant: "default" }))}
            onClick={() => closeDay(today)}
          >
            Close the day
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
