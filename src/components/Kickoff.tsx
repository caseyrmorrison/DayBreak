"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateKey, greetingFor } from "@/lib/dates";
import { LIMITS } from "@/lib/schema";
import { rolloverSuggestions, useDaybreak, type TaskDraft } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

const ESTIMATES = [25, 50, 90];

export default function Kickoff({ today }: { today: string }) {
  const startDay = useDaybreak((s) => s.startDay);
  const plans = useDaybreak((s) => s.plans);
  const inbox = useDaybreak((s) => s.inbox);

  const [big, setBig] = useState("");
  const [why, setWhy] = useState("");
  const [estimate, setEstimate] = useState<number | null>(null);
  const [second, setSecond] = useState("");
  const [third, setThird] = useState("");

  const suggestions = useMemo(() => {
    const rollover = rolloverSuggestions({ plans }, today);
    const fromInbox = inbox.slice(0, 5).map((i) => i.text);
    return [...new Set([...rollover, ...fromInbox])].slice(0, 6);
  }, [plans, inbox, today]);

  const fillNextSlot = (text: string) => {
    if (!big.trim()) setBig(text);
    else if (!second.trim()) setSecond(text);
    else if (!third.trim()) setThird(text);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!big.trim()) return;
    const drafts: TaskDraft[] = [
      {
        title: big,
        note: why.trim() || undefined,
        estimateMin: estimate ?? undefined,
      },
      ...(second.trim() ? [{ title: second }] : []),
      ...(third.trim() ? [{ title: third }] : []),
    ];
    startDay(today, drafts);
  };

  const greeting = greetingFor(new Date().getHours());

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      <header>
        <p className="text-sm text-muted-foreground">{formatDateKey(today)}</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">
          {greeting}
        </h1>
      </header>

      <div className="flex flex-col gap-3">
        <label htmlFor="kickoff-big" className="text-base font-medium">
          What&apos;s the one thing that would make today a win?
        </label>
        <Input
          id="kickoff-big"
          autoFocus
          value={big}
          maxLength={LIMITS.taskTitle}
          onChange={(e) => setBig(e.target.value)}
          placeholder="Ship the login flow for the side project"
          className="h-12 text-base"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Estimate:</span>
          {ESTIMATES.map((min) => (
            <button
              key={min}
              type="button"
              aria-pressed={estimate === min}
              onClick={() => setEstimate(estimate === min ? null : min)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                estimate === min
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
              )}
            >
              {min} min
            </button>
          ))}
        </div>
        <label htmlFor="kickoff-why" className="sr-only">
          Why it matters
        </label>
        <Input
          id="kickoff-why"
          value={why}
          maxLength={LIMITS.taskNote}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Why it matters (optional)"
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Then, if there&apos;s time (optional)
        </p>
        <label htmlFor="kickoff-second" className="sr-only">
          Second task
        </label>
        <Input
          id="kickoff-second"
          value={second}
          maxLength={LIMITS.taskTitle}
          onChange={(e) => setSecond(e.target.value)}
          placeholder="A second task"
        />
        <label htmlFor="kickoff-third" className="sr-only">
          Third task
        </label>
        <Input
          id="kickoff-third"
          value={third}
          maxLength={LIMITS.taskTitle}
          onChange={(e) => setThird(e.target.value)}
          placeholder="A third task"
        />
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            From yesterday and your inbox
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => fillNextSlot(text)}
                className="max-w-full truncate rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                {text.length > 60 ? `${text.slice(0, 57)}…` : text}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Button type="submit" size="lg" disabled={!big.trim()}>
          Start the day
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Three tasks max. The point is choosing, not listing.
        </p>
        <button
          type="button"
          onClick={() => useUi.getState().setSyncDialogOpen(true)}
          className="mt-6 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Have Daybreak on another device? Set up sync
        </button>
      </div>
    </form>
  );
}
