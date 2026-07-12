"use client";

import { useEffect, useState } from "react";
import { addDays, todayKey } from "@/lib/dates";
import { useDaybreak } from "@/lib/store";
import { initSyncEngine, teardownSyncEngine } from "@/lib/sync";
import { useUi } from "@/lib/ui-store";
import CommandPalette from "./CommandPalette";
import HistorySheet from "./HistorySheet";
import Kickoff from "./Kickoff";
import SyncDialog from "./SyncDialog";
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
  const reconcilePastDays = useDaybreak((s) => s.reconcilePastDays);
  const prepareOpen = useUi((s) => s.prepareOpen);
  const setPrepareOpen = useUi((s) => s.setPrepareOpen);

  useEffect(() => {
    const markAnyway = () => {
      if (!useDaybreak.getState().hydrated) {
        useDaybreak.getState().markHydrated();
      }
    };
    Promise.resolve(useDaybreak.persist.rehydrate()).catch(markAnyway);
    // Belt and suspenders: whatever goes wrong, never strand the user
    // on the loading screen — worst case they get a fresh view while
    // their data stays untouched in localStorage.
    const timer = setTimeout(markAnyway, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    initSyncEngine();
    return teardownSyncEngine;
  }, [hydrated]);

  // On open and whenever the local date ticks over, close out any days
  // left open — including a plan prepared last night that is now today.
  useEffect(() => {
    if (hydrated) reconcilePastDays(today);
  }, [hydrated, today, reconcilePastDays]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-1 flex-col px-6 py-14 sm:py-20">
      {!hydrated ? (
        <p className="text-sm text-muted-foreground" aria-busy="true">
          Loading your day…
        </p>
      ) : prepareOpen ? (
        <Kickoff
          date={addDays(today, 1)}
          mode="prepare"
          onComplete={() => setPrepareOpen(false)}
          onBack={() => setPrepareOpen(false)}
        />
      ) : plan ? (
        <TodayView today={today} />
      ) : (
        <Kickoff date={today} />
      )}
      {hydrated && <CommandPalette today={today} />}
      {hydrated && <SyncDialog />}
      {hydrated && <HistorySheet today={today} />}
    </main>
  );
}
