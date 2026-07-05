import { create } from "zustand";

// Ephemeral UI state. Deliberately not persisted: a reload should
// never reopen a palette or resume a focus session.
export type SyncStatus = "off" | "idle" | "syncing" | "error";

type UiState = {
  paletteOpen: boolean;
  focusTaskId: string | null;
  syncDialogOpen: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncAt: string | null;
  setPaletteOpen: (open: boolean) => void;
  setFocusTask: (taskId: string | null) => void;
  setSyncDialogOpen: (open: boolean) => void;
  setSyncState: (state: {
    status?: SyncStatus;
    error?: string | null;
    lastSyncAt?: string | null;
  }) => void;
};

export const useUi = create<UiState>()((set) => ({
  paletteOpen: false,
  focusTaskId: null,
  syncDialogOpen: false,
  syncStatus: "off",
  syncError: null,
  lastSyncAt: null,
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setFocusTask: (taskId) => set({ focusTaskId: taskId }),
  setSyncDialogOpen: (open) => set({ syncDialogOpen: open }),
  setSyncState: ({ status, error, lastSyncAt }) =>
    set((s) => ({
      syncStatus: status ?? s.syncStatus,
      syncError: error === undefined ? s.syncError : error,
      lastSyncAt: lastSyncAt === undefined ? s.lastSyncAt : lastSyncAt,
    })),
}));
