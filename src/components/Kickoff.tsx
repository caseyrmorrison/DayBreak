"use client";

import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateKey, greetingFor } from "@/lib/dates";
import { LIMITS } from "@/lib/schema";
import { rolloverSuggestions, useDaybreak, type TaskDraft } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

const ESTIMATES = [25, 50, 90];

type KickoffMode = "today" | "prepare";

// Shared planning form. In "today" mode it starts the current day; in
// "prepare" mode it plans a future day (tomorrow) whose tasks stay
// locked until that date arrives.
export default function Kickoff({
  date,
  mode = "today",
  onComplete,
  onBack,
}: {
  date: string;
  mode?: KickoffMode;
  onComplete?: () => void;
  onBack?: () => void;
}) {
  const startDay = useDaybreak((s) => s.startDay);
  const prepareDay = useDaybreak((s) => s.prepareDay);
  const plans = useDaybreak((s) => s.plans);
  const inbox = useDaybreak((s) => s.inbox);

  const prepare = mode === "prepare";

  // When changing an already-prepared day, seed the form from it so
  // "Change" edits rather than starts from scratch. Read once at mount.
  const existing = prepare ? useDaybreak.getState().plans[date] : undefined;
  const initEstimate = existing?.tasks[0]?.estimateMin ?? null;
  const [big, setBig] = useState(() => existing?.tasks[0]?.title ?? "");
  const [why, setWhy] = useState(() => existing?.tasks[0]?.note ?? "");
  const [estimate, setEstimate] = useState<number | null>(() => initEstimate);
  // Custom-minutes field. Non-empty only when the estimate isn't a preset,
  // so a preset chip and the custom field are never both "active".
  const [estimateText, setEstimateText] = useState(() =>
    initEstimate && !ESTIMATES.includes(initEstimate) ? String(initEstimate) : "",
  );
  const [second, setSecond] = useState(() => existing?.tasks[1]?.title ?? "");
  const [third, setThird] = useState(() => existing?.tasks[2]?.title ?? "");

  const pickPreset = (min: number) => {
    setEstimateText("");
    setEstimate((current) => (current === min && !estimateText ? null : min));
  };

  const changeCustom = (raw: string) => {
    const text = raw.replace(/[^0-9]/g, "").slice(0, 3);
    setEstimateText(text);
    const n = Number.parseInt(text, 10);
    setEstimate(text && n > 0 ? Math.min(n, LIMITS.maxEstimateMin) : null);
  };

  const suggestions = useMemo(() => {
    const rollover = rolloverSuggestions({ plans }, date);
    const fromInbox = inbox.slice(0, 5).map((i) => i.text);
    return [...new Set([...rollover, ...fromInbox])].slice(0, 6);
  }, [plans, inbox, date]);

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
    const ok = prepare ? prepareDay(date, drafts) : startDay(date, drafts);
    if (ok) onComplete?.();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      <header>
        {prepare && onBack && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2.5 mb-3"
            onClick={onBack}
          >
            <ArrowLeft aria-hidden />
            Back to today
          </Button>
        )}
        <p className="text-sm text-muted-foreground">{formatDateKey(date)}</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">
          {prepare ? "Plan tomorrow" : greetingFor(new Date().getHours())}
        </h1>
        {prepare && (
          <p className="mt-2 text-sm text-muted-foreground">
            You can start these when the day begins — not before.
          </p>
        )}
      </header>

      <div className="flex flex-col gap-3">
        <label htmlFor="kickoff-big" className="text-base font-medium">
          {prepare
            ? "What's the one thing that would make tomorrow a win?"
            : "What's the one thing that would make today a win?"}
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
          {ESTIMATES.map((min) => {
            const active = !estimateText && estimate === min;
            return (
              <button
                key={min}
                type="button"
                aria-pressed={active}
                onClick={() => pickPreset(min)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
                )}
              >
                {min} min
              </button>
            );
          })}
          <span className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Custom estimate in minutes"
              value={estimateText}
              onChange={(e) => changeCustom(e.target.value)}
              placeholder="45"
              className={cn(
                "h-8 w-14 rounded-full border px-3 text-xs transition-colors outline-none focus-visible:border-primary",
                estimateText
                  ? "border-primary text-foreground"
                  : "border-border text-muted-foreground",
              )}
            />
            <span className="text-xs text-muted-foreground">min</span>
          </span>
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
            {prepare
              ? "From today and your inbox"
              : "From yesterday and your inbox"}
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
          {prepare ? "Save tomorrow's plan" : "Start the day"}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Three tasks max. The point is choosing, not listing.
        </p>
        {!prepare && (
          <button
            type="button"
            onClick={() => useUi.getState().setSyncDialogOpen(true)}
            className="mt-6 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Have Daybreak on another device? Set up sync
          </button>
        )}
      </div>
    </form>
  );
}
