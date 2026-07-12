"use client";

import { Inbox, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LIMITS } from "@/lib/schema";
import { useDaybreak } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function InboxSheet({ today }: { today: string }) {
  const inbox = useDaybreak((s) => s.inbox);
  const plan = useDaybreak((s) => s.plans[today]);
  const removeFromInbox = useDaybreak((s) => s.removeFromInbox);
  const promoteInboxItem = useDaybreak((s) => s.promoteInboxItem);

  const canPromote = Boolean(
    plan && !plan.shutdownAt && plan.tasks.length < LIMITS.maxTasksPerDay,
  );

  return (
    <Dialog>
      <DialogTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        aria-label={`Inbox${inbox.length > 0 ? ` — ${inbox.length}` : ""}`}
      >
        <Inbox aria-hidden />
        <span className="hidden sm:inline">Inbox</span>
        {inbox.length > 0 ? ` · ${inbox.length}` : ""}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inbox</DialogTitle>
          <DialogDescription>
            Thoughts you dumped while focusing. Promote one into today or let
            it go.
          </DialogDescription>
        </DialogHeader>
        {inbox.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing here. When something pops into your head mid-focus, dump it
            in the box on the main screen — it lands here instead of derailing
            you.
          </p>
        ) : (
          <ul className="-mx-2 flex max-h-80 flex-col overflow-y-auto">
            {inbox.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
              >
                <span className="min-w-0 break-words py-1 text-sm">
                  {item.text}
                </span>
                <span className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Add "${item.text}" to today`}
                    disabled={!canPromote}
                    onClick={() => promoteInboxItem(item.id, today)}
                  >
                    <Plus aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete "${item.text}"`}
                    onClick={() => removeFromInbox(item.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {!canPromote && inbox.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {plan?.shutdownAt
              ? "The day is closed, so promoting is off."
              : `Today already has ${LIMITS.maxTasksPerDay} tasks — finish or remove one first.`}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
