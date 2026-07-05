"use client";

import { useEffect, useState } from "react";
import { todayKey } from "@/lib/dates";
import { useDaybreak } from "@/lib/store";
import CommandPalette from "./CommandPalette";
import Kickoff from "./Kickoff";
import TodayView from "./TodayView";

function useTodayKey(): string {
  const [key, setKey] = useState(() => todayKey());
  useEffect(() => {
    const id = setInterval(() => {
      const next = todayKey();
      setKey((current) => (current === next ? current : next));
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return key;
}

export default function DaybreakApp() {
  const hydrated = useDaybreak((s) => s.hydrated);
  const today = useTodayKey();
  const plan = useDaybreak((s) => s.plans[today]);

  useEffect(() => {
    void useDaybreak.persist.rehydrate();
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-1 flex-col px-6 py-14 sm:py-20">
      {!hydrated ? (
        <p className="text-sm text-muted-foreground" aria-busy="true">
          Loading your day…
        </p>
      ) : plan ? (
        <TodayView today={today} />
      ) : (
        <Kickoff today={today} />
      )}
      {hydrated && <CommandPalette today={today} />}
    </main>
  );
}
