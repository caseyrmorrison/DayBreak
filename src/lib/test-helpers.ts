import { EPOCH, type PersistedState } from "./schema";
import { useDaybreak } from "./store";
import { useUi } from "./ui-store";

export function baseState(): PersistedState {
  return {
    plans: {},
    inbox: [],
    inboxDeletions: {},
    streak: { count: 0, lastWinDate: null, updatedAt: EPOCH },
  };
}

export function resetStores(): void {
  localStorage.clear();
  useDaybreak.setState(baseState());
  useUi.setState({
    paletteOpen: false,
    focusTaskId: null,
    syncDialogOpen: false,
    historyOpen: false,
    syncStatus: "off",
    syncError: null,
    lastSyncAt: null,
  });
}
