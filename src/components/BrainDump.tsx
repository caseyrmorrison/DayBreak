"use client";

import { Inbox } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LIMITS } from "@/lib/schema";
import { useDaybreak } from "@/lib/store";

export default function BrainDump() {
  const addToInbox = useDaybreak((s) => s.addToInbox);
  const [text, setText] = useState("");
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (addToInbox(text)) {
      setText("");
      setFlash(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(false), 2000);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-3">
      <Inbox className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor="brain-dump" className="sr-only">
        Brain dump — capture a thought for later
      </label>
      <input
        id="brain-dump"
        value={text}
        maxLength={LIMITS.inboxText}
        onChange={(e) => setText(e.target.value)}
        placeholder="On your mind? Dump it here and get back to work"
        autoComplete="off"
        className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
      />
      <span
        aria-live="polite"
        className="whitespace-nowrap text-xs text-muted-foreground"
      >
        {flash ? "Captured" : ""}
      </span>
    </form>
  );
}
