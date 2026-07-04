"use client";

import { ArrowLeft, Check, Pause, Play } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/schema";

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function FocusOverlay({
  task,
  onDone,
  onClose,
}: {
  task: Task;
  onDone: () => void;
  onClose: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const startRef = useRef(0);
  const accumRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(
        Math.floor((accumRef.current + Date.now() - startRef.current) / 1000),
      );
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const togglePause = () => {
    if (running) accumRef.current += Date.now() - startRef.current;
    setRunning(!running);
  };

  const target = task.estimateMin ? task.estimateMin * 60 : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Focusing on ${task.title}`}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6"
    >
      <p className="text-sm text-muted-foreground">Focusing on</p>
      <h2 className="max-w-lg text-center text-2xl font-medium tracking-tight">
        {task.title}
      </h2>
      <p className="font-mono text-6xl tabular-nums">
        {formatElapsed(elapsed)}
      </p>
      <p className="h-5 text-sm text-muted-foreground">
        {target
          ? elapsed >= target
            ? "Past your estimate — wrap up or keep going."
            : `Aiming for ${task.estimateMin} min.`
          : ""}
      </p>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={togglePause}>
          {running ? <Pause aria-hidden /> : <Play aria-hidden />}
          {running ? "Pause" : "Resume"}
        </Button>
        <Button onClick={onDone}>
          <Check aria-hidden />
          Done
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="mt-4 text-muted-foreground"
      >
        <ArrowLeft aria-hidden />
        Back to today
      </Button>
    </motion.div>
  );
}
