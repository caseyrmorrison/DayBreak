"use client";

import {
  Check,
  Cloud,
  History,
  Moon,
  Play,
  Plus,
  Sun,
  Sunrise,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LIMITS } from "@/lib/schema";
import { preparedPlan, useDaybreak } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

type PaletteAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
};

function truncate(text: string, max = 48): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function CommandPalette({ today }: { today: string }) {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const setFocusTask = useUi((s) => s.setFocusTask);
  const syncStatus = useUi((s) => s.syncStatus);
  const setSyncDialogOpen = useUi((s) => s.setSyncDialogOpen);
  const setHistoryOpen = useUi((s) => s.setHistoryOpen);
  const setPrepareOpen = useUi((s) => s.setPrepareOpen);
  const plan = useDaybreak((s) => s.plans[today]);
  const plans = useDaybreak((s) => s.plans);
  const addToInbox = useDaybreak((s) => s.addToInbox);
  const toggleTask = useDaybreak((s) => s.toggleTask);
  const closeDay = useDaybreak((s) => s.closeDay);
  const reopenDay = useDaybreak((s) => s.reopenDay);

  const hasPrepared = Boolean(preparedPlan({ plans }, today));

  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        setQuery("");
        setHighlighted(0);
      }
    },
    [setOpen],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleOpenChange(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleOpenChange]);

  const actions = useMemo<PaletteAction[]>(() => {
    const dismiss = () => handleOpenChange(false);
    const trimmed = query.trim();
    const result: PaletteAction[] = [];

    if (trimmed) {
      result.push({
        id: "capture",
        label: `Add to inbox: "${truncate(trimmed)}"`,
        icon: <Plus aria-hidden />,
        run: () => {
          addToInbox(trimmed);
          dismiss();
        },
      });
    }

    const contextual: PaletteAction[] = [];
    const closed = Boolean(plan?.shutdownAt);

    if (plan && !closed) {
      for (const task of plan.tasks) {
        if (!task.done) {
          contextual.push({
            id: `focus-${task.id}`,
            label: `Start focus: ${truncate(task.title)}`,
            icon: <Play aria-hidden />,
            run: () => {
              setFocusTask(task.id);
              dismiss();
            },
          });
        }
        contextual.push({
          id: `toggle-${task.id}`,
          label: task.done
            ? `Mark not done: ${truncate(task.title)}`
            : `Mark done: ${truncate(task.title)}`,
          icon: <Check aria-hidden />,
          run: () => {
            toggleTask(today, task.id);
            dismiss();
          },
        });
      }
      contextual.push({
        id: "close-day",
        label: "Close the day",
        icon: <Moon aria-hidden />,
        run: () => {
          closeDay(today);
          dismiss();
        },
      });
    }
    if (plan && closed) {
      contextual.push({
        id: "reopen-day",
        label: "Reopen the day",
        icon: <Sun aria-hidden />,
        run: () => {
          reopenDay(today);
          dismiss();
        },
      });
    }

    // Plan tomorrow — available once today exists and nothing is
    // prepared yet. Its tasks stay locked until the day arrives.
    if (plan && !hasPrepared) {
      contextual.push({
        id: "plan-tomorrow",
        label: "Plan tomorrow",
        icon: <Sunrise aria-hidden />,
        run: () => {
          dismiss();
          setPrepareOpen(true);
        },
      });
    }

    contextual.push({
      id: "history",
      label: "Show history",
      icon: <History aria-hidden />,
      run: () => {
        dismiss();
        setHistoryOpen(true);
      },
    });

    contextual.push(
      syncStatus === "off"
        ? {
            id: "setup-sync",
            label: "Set up sync across devices",
            icon: <Cloud aria-hidden />,
            run: () => {
              dismiss();
              setSyncDialogOpen(true);
            },
          }
        : {
            id: "sync-now",
            label: "Sync now",
            icon: <Cloud aria-hidden />,
            run: () => {
              void import("@/lib/sync").then((m) => m.syncNow());
              dismiss();
            },
          },
    );

    const q = trimmed.toLowerCase();
    result.push(
      ...(q
        ? contextual.filter((a) => a.label.toLowerCase().includes(q))
        : contextual),
    );
    return result;
  }, [query, plan, hasPrepared, today, addToInbox, toggleTask, closeDay, reopenDay, setFocusTask, handleOpenChange, syncStatus, setSyncDialogOpen, setHistoryOpen, setPrepareOpen]);

  const clampedHighlight = Math.min(highlighted, Math.max(actions.length - 1, 0));

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, actions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      actions[clampedHighlight]?.run();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[22%] translate-y-0 gap-0 p-0 sm:max-w-md"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <label htmlFor="palette-input" className="sr-only">
          Type a thought to capture it, or search actions
        </label>
        <input
          id="palette-input"
          autoFocus
          autoComplete="off"
          value={query}
          maxLength={LIMITS.inboxText}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(0);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Capture a thought or search actions…"
          className="h-12 w-full rounded-t-xl border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground/70"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-actions"
          aria-activedescendant={
            actions[clampedHighlight]
              ? `palette-action-${actions[clampedHighlight].id}`
              : undefined
          }
        />
        <ul
          id="palette-actions"
          ref={listRef}
          role="listbox"
          aria-label="Actions"
          className="max-h-72 overflow-y-auto p-1.5"
        >
          {actions.length === 0 && (
            <li className="px-2.5 py-2 text-sm text-muted-foreground">
              Nothing matches. Type a thought and press Enter to capture it
              to your inbox.
            </li>
          )}
          {actions.map((action, index) => (
            <li
              key={action.id}
              id={`palette-action-${action.id}`}
              role="option"
              aria-selected={index === clampedHighlight}
              onMouseEnter={() => setHighlighted(index)}
              onClick={action.run}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
                index === clampedHighlight && "bg-muted",
              )}
            >
              {action.icon}
              <span className="min-w-0 truncate">{action.label}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
