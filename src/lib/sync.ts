import { todayKey } from "./dates";
import { mergeStates } from "./merge";
import { persistedStateSchema, type PersistedState } from "./schema";
import { useDaybreak } from "./store";
import {
  decryptState,
  deriveSyncId,
  deriveSyncKey,
  encryptState,
  formatSyncCode,
  generateSyncCode,
  normalizeSyncCode,
} from "./sync-crypto";
import { useUi } from "./ui-store";

const CONFIG_KEY = "daybreak.sync.v1";

// The server is a dumb versioned vault: pull the blob, merge locally,
// push with compare-and-swap. On a version conflict the server hands
// back the current blob so the client can re-merge and retry.

export type PullResult = { version: number; data: string | null };
export type PushResult =
  | { ok: true; version: number }
  | { ok: false; conflict: PullResult };

export type SyncTransport = {
  pull: (id: string) => Promise<PullResult>;
  push: (id: string, version: number, data: string) => Promise<PushResult>;
  remove: (id: string) => Promise<void>;
};

type SyncApiResponse = {
  ok: boolean;
  version?: number;
  data?: string | null;
  error?: string;
};

async function callApi(payload: Record<string, unknown>): Promise<Response> {
  return fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function httpTransport(): SyncTransport {
  return {
    async pull(id) {
      const res = await callApi({ action: "pull", id });
      if (!res.ok) throw new Error("Sync server unreachable");
      const body = (await res.json()) as SyncApiResponse;
      return { version: body.version ?? 0, data: body.data ?? null };
    },
    async push(id, version, data) {
      const res = await callApi({ action: "push", id, version, data });
      if (res.status === 409) {
        const body = (await res.json()) as SyncApiResponse;
        return {
          ok: false,
          conflict: { version: body.version ?? 0, data: body.data ?? null },
        };
      }
      if (!res.ok) throw new Error("Sync server unreachable");
      const body = (await res.json()) as SyncApiResponse;
      return { ok: true, version: body.version ?? 0 };
    },
    async remove(id) {
      const res = await callApi({ action: "delete", id });
      if (!res.ok) throw new Error("Sync server unreachable");
    },
  };
}

type SyncConfig = { code: string };

export function getSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown };
    if (typeof parsed.code !== "string" || !normalizeSyncCode(parsed.code)) {
      return null;
    }
    return { code: parsed.code };
  } catch {
    return null;
  }
}

function saveSyncConfig(config: SyncConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function clearSyncConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
}

export function getSyncCodeFormatted(): string | null {
  const config = getSyncConfig();
  return config ? formatSyncCode(config.code) : null;
}

function snapshot(): PersistedState {
  const s = useDaybreak.getState();
  return {
    plans: s.plans,
    inbox: s.inbox,
    inboxDeletions: s.inboxDeletions,
    streak: s.streak,
    settings: s.settings,
  };
}

let applyingRemote = false;

function applyMerged(merged: PersistedState): void {
  applyingRemote = true;
  try {
    useDaybreak.getState().applyMergedState(merged);
  } finally {
    applyingRemote = false;
  }
}

export async function runSyncCycle(opts: {
  id: string;
  key: Uint8Array;
  transport: SyncTransport;
  today: string;
  getLocal: () => PersistedState;
  applyMerged: (merged: PersistedState) => void;
}): Promise<void> {
  let { version, data } = await opts.transport.pull(opts.id);

  for (let attempt = 0; attempt < 4; attempt++) {
    const local = opts.getLocal();
    let remote: PersistedState | null = null;
    if (data) {
      let decrypted: unknown;
      try {
        decrypted = decryptState(opts.key, data);
      } catch {
        throw new Error(
          "Couldn't decrypt the synced copy — this code doesn't match it.",
        );
      }
      const parsed = persistedStateSchema.safeParse(decrypted);
      if (!parsed.success) {
        throw new Error("The synced copy failed validation.");
      }
      remote = parsed.data;
    }

    const merged = remote
      ? mergeStates(local, remote, opts.today)
      : mergeStates(local, local, opts.today);
    if (JSON.stringify(merged) !== JSON.stringify(local)) {
      opts.applyMerged(merged);
    }
    // If the merge changed nothing relative to the server copy there
    // is nothing to upload.
    if (
      remote &&
      JSON.stringify(mergeStates(remote, remote, opts.today)) ===
        JSON.stringify(merged)
    ) {
      return;
    }

    const result = await opts.transport.push(
      opts.id,
      version,
      encryptState(opts.key, merged),
    );
    if (result.ok) return;
    version = result.conflict.version;
    data = result.conflict.data;
  }
  throw new Error("Sync kept conflicting — try again in a moment.");
}

export async function syncNow(): Promise<boolean> {
  const config = getSyncConfig();
  if (!config) return false;
  const ui = useUi.getState();
  if (ui.syncStatus === "syncing") return false;
  ui.setSyncState({ status: "syncing", error: null });
  try {
    await runSyncCycle({
      id: deriveSyncId(config.code),
      key: deriveSyncKey(config.code),
      transport: httpTransport(),
      today: todayKey(),
      getLocal: snapshot,
      applyMerged,
    });
    useUi.getState().setSyncState({
      status: "idle",
      error: null,
      lastSyncAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    useUi.getState().setSyncState({
      status: "error",
      error: error instanceof Error ? error.message : "Sync failed",
    });
    return false;
  }
}

export async function enableSync(): Promise<string> {
  const code = generateSyncCode();
  saveSyncConfig({ code });
  useUi.getState().setSyncState({ status: "idle", error: null });
  await syncNow();
  return formatSyncCode(code);
}

export async function joinSync(input: string): Promise<void> {
  const code = normalizeSyncCode(input);
  if (!code) {
    throw new Error("That doesn't look like a sync code — check for typos.");
  }
  saveSyncConfig({ code });
  useUi.getState().setSyncState({ status: "idle", error: null });
  const ok = await syncNow();
  if (!ok) {
    const message = useUi.getState().syncError ?? "Could not link this device.";
    clearSyncConfig();
    useUi.getState().setSyncState({ status: "off", error: null });
    throw new Error(message);
  }
}

export async function disableSync(opts?: {
  deleteRemote?: boolean;
}): Promise<void> {
  const config = getSyncConfig();
  if (config && opts?.deleteRemote) {
    try {
      await httpTransport().remove(deriveSyncId(config.code));
    } catch {
      // Unlinking locally still succeeds if the server is unreachable.
    }
  }
  clearSyncConfig();
  useUi.getState().setSyncState({ status: "off", error: null, lastSyncAt: null });
}

let unsubscribeStore: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let visibilityHandler: (() => void) | null = null;

const SYNC_DEBOUNCE_MS = 2500;

export function initSyncEngine(): void {
  const config = getSyncConfig();
  useUi.getState().setSyncState({ status: config ? "idle" : "off" });
  if (config) void syncNow();

  unsubscribeStore = useDaybreak.subscribe((state, prev) => {
    if (applyingRemote || !state.hydrated || !getSyncConfig()) return;
    const dataChanged =
      state.plans !== prev.plans ||
      state.inbox !== prev.inbox ||
      state.inboxDeletions !== prev.inboxDeletions ||
      state.streak !== prev.streak ||
      state.settings !== prev.settings;
    if (!dataChanged) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void syncNow(), SYNC_DEBOUNCE_MS);
  });

  visibilityHandler = () => {
    if (document.hidden && getSyncConfig()) {
      if (debounceTimer) clearTimeout(debounceTimer);
      void syncNow();
    }
  };
  document.addEventListener("visibilitychange", visibilityHandler);
}

export function teardownSyncEngine(): void {
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
}
