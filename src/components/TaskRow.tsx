"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import type { Task } from "@/lib/schema";
import { cn } from "@/lib/utils";

export default function TaskRow({
  task,
  big = false,
  onToggle,
  trailing,
}: {
  task: Task;
  big?: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 items-center gap-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={
          task.done
            ? `Mark "${task.title}" as not done`
            : `Mark "${task.title}" as done`
        }
        onClick={onToggle}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          big ? "size-6" : "size-5",
          task.done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 hover:border-primary",
        )}
      >
        {task.done && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex"
          >
            <Check
              className={big ? "size-3.5" : "size-3"}
              strokeWidth={3}
              aria-hidden
            />
          </motion.span>
        )}
      </button>
      <span
        className={cn(
          "min-w-0 flex-1 break-words transition-colors",
          big ? "text-lg font-medium" : "text-[15px]",
          task.done && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </span>
      {trailing}
    </div>
  );
}
