import { describe, expect, it } from "vitest";
import { EPOCH, type PersistedState } from "./schema";
import { runSyncCycle, type SyncTransport } from "./sync";
import {
  decryptState,
  deriveSyncId,
  deriveSyncKey,
  encryptState,
  generateSyncCode,
} from "./sync-crypto";
import { baseState } from "./test-helpers";

const TODAY = "2026-07-04";

// In-memory stand-in for the /api/sync route with identical
// compare-and-swap semantics.
function memoryVault() {
  const stored = { version: 0, data: null as string | null };
  const transport: SyncTransport = {
    async pull() {
      return { ...stored };
    },
    async push(_id, version, data) {
      if (version !== stored.version) return { ok: false, conflict: { ...stored } };
      stored.version += 1;
      stored.data = data;
      return { ok: true, version: stored.version };
    },
    async remove() {
      stored.version = 0;
      stored.data = null;
    },
  };
  return { stored, transport };
}

type Device = {
  state: PersistedState;
  getLocal: () => PersistedState;
  applyMerged: (merged: PersistedState) => void;
};

function device(initial: PersistedState): Device {
  const d: Device = {
    state: initial,
    getLocal: () => d.state,
    applyMerged: (merged) => {
      d.state = merged;
    },
  };
  return d;
}

function withPlan(title: string, updatedAt: string): PersistedState {
  return {
    ...baseState(),
    plans: {
      [TODAY]: {
        date: TODAY,
        tasks: [{ id: `task-${title}-id`, title, done: false }],
        updatedAt,
      },
    },
  };
}

function withInbox(text: string): PersistedState {
  return {
    ...baseState(),
    inbox: [{ id: `inbox-${text}-id`, text, createdAt: "2026-07-04T08:00:00.000Z" }],
  };
}

describe("runSyncCycle", () => {
  const code = generateSyncCode();
  const id = deriveSyncId(code);
  const key = deriveSyncKey(code);

  it("converges two devices through the vault", async () => {
    const { transport } = memoryVault();
    const a = device(withPlan("ship it", "2026-07-04T08:00:00.000Z"));
    const b = device(withInbox("a thought from device b"));

    await runSyncCycle({ id, key, transport, today: TODAY, ...a });
    await runSyncCycle({ id, key, transport, today: TODAY, ...b });
    await runSyncCycle({ id, key, transport, today: TODAY, ...a });

    expect(a.state).toEqual(b.state);
    expect(a.state.plans[TODAY].tasks[0].title).toBe("ship it");
    expect(a.state.inbox[0].text).toBe("a thought from device b");
  });

  it("retries through a compare-and-swap conflict and merges both writes", async () => {
    const { stored, transport } = memoryVault();
    // Device C already wrote version 1.
    stored.version = 1;
    stored.data = encryptState(key, withPlan("from device c", "2026-07-04T09:00:00.000Z"));

    // Device A syncs with a stale pull (saw the vault before C's write).
    const stale: SyncTransport = {
      pull: async () => ({ version: 0, data: null }),
      push: transport.push,
      remove: transport.remove,
    };
    const a = device(withInbox("from device a"));
    await runSyncCycle({ id, key, transport: stale, today: TODAY, ...a });

    expect(stored.version).toBe(2);
    const final = decryptState(key, stored.data!) as PersistedState;
    expect(final.plans[TODAY].tasks[0].title).toBe("from device c");
    expect(final.inbox[0].text).toBe("from device a");
    expect(a.state).toEqual(final);
  });

  it("does not push when the vault already matches", async () => {
    const { stored, transport } = memoryVault();
    const a = device(withPlan("stable", "2026-07-04T08:00:00.000Z"));
    await runSyncCycle({ id, key, transport, today: TODAY, ...a });
    const versionAfterFirst = stored.version;
    await runSyncCycle({ id, key, transport, today: TODAY, ...a });
    expect(stored.version).toBe(versionAfterFirst);
  });

  it("fails loudly when the code cannot decrypt the vault", async () => {
    const { stored, transport } = memoryVault();
    stored.version = 1;
    stored.data = encryptState(deriveSyncKey(generateSyncCode()), baseState());
    const a = device(baseState());
    await expect(
      runSyncCycle({ id, key, transport, today: TODAY, ...a }),
    ).rejects.toThrow(/decrypt/i);
  });

  it("rejects a vault payload that fails schema validation", async () => {
    const { stored, transport } = memoryVault();
    stored.version = 1;
    stored.data = encryptState(key, { plans: "not-a-record" });
    const a = device(baseState());
    await expect(
      runSyncCycle({ id, key, transport, today: TODAY, ...a }),
    ).rejects.toThrow(/validation/i);
  });

  it("push after empty pull stores a blob the other device can read", async () => {
    const { stored, transport } = memoryVault();
    const a = device({
      ...baseState(),
      streak: { count: 4, lastWinDate: "2026-07-03", updatedAt: "2026-07-03T21:00:00.000Z" },
    });
    await runSyncCycle({ id, key, transport, today: TODAY, ...a });
    const stored2 = decryptState(key, stored.data!) as PersistedState;
    expect(stored2.streak.count).toBe(4);
    expect(stored2.streak.updatedAt).not.toBe(EPOCH);
  });
});
