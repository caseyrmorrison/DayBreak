import { create } from "zustand";

// Ephemeral UI state. Deliberately not persisted: a reload should
// never reopen a palette or resume a focus session.
type UiState = {
  paletteOpen: boolean;
  focusTaskId: string | null;
  setPaletteOpen: (open: boolean) => void;
  setFocusTask: (taskId: string | null) => void;
};

export const useUi = create<UiState>()((set) => ({
  paletteOpen: false,
  focusTaskId: null,
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setFocusTask: (taskId) => set({ focusTaskId: taskId }),
}));
