import { describe, expect, it } from "vitest";
import {
  decryptState,
  deriveSyncId,
  deriveSyncKey,
  encryptState,
  formatSyncCode,
  generateSyncCode,
  normalizeSyncCode,
} from "./sync-crypto";

describe("sync codes", () => {
  it("generates 32-char codes that survive display formatting", () => {
    const code = generateSyncCode();
    expect(code).toHaveLength(32);
    expect(normalizeSyncCode(formatSyncCode(code))).toBe(code);
  });

  it("normalizes lowercase, separators, and ambiguous characters", () => {
    const code = generateSyncCode();
    const mangled = formatSyncCode(code).toLowerCase().replace(/-/g, " ");
    expect(normalizeSyncCode(mangled)).toBe(code);
    expect(normalizeSyncCode("O".repeat(32))).toBe("0".repeat(32));
    expect(normalizeSyncCode("I".repeat(16) + "L".repeat(16))).toBe(
      "1".repeat(32),
    );
  });

  it("rejects wrong lengths", () => {
    expect(normalizeSyncCode("SHORT")).toBeNull();
    expect(normalizeSyncCode("A".repeat(33))).toBeNull();
    expect(normalizeSyncCode("")).toBeNull();
  });
});

describe("derivation", () => {
  it("is deterministic and domain-separated", () => {
    const code = generateSyncCode();
    expect(deriveSyncId(code)).toBe(deriveSyncId(code));
    expect(deriveSyncId(code)).toMatch(/^[0-9a-f]{64}$/);
    expect(deriveSyncId(code)).not.toBe(
      Buffer.from(deriveSyncKey(code)).toString("hex"),
    );
    expect(deriveSyncId(generateSyncCode())).not.toBe(deriveSyncId(code));
  });
});

describe("encryption", () => {
  it("roundtrips arbitrary state", () => {
    const key = deriveSyncKey(generateSyncCode());
    const value = { plans: { a: 1 }, nested: [1, 2, { deep: "yes" }] };
    expect(decryptState(key, encryptState(key, value))).toEqual(value);
  });

  it("produces different ciphertext each time (fresh IV)", () => {
    const key = deriveSyncKey(generateSyncCode());
    expect(encryptState(key, "same")).not.toBe(encryptState(key, "same"));
  });

  it("throws on the wrong key and on tampering", () => {
    const keyA = deriveSyncKey(generateSyncCode());
    const keyB = deriveSyncKey(generateSyncCode());
    const blob = encryptState(keyA, { secret: true });
    expect(() => decryptState(keyB, blob)).toThrow();
    const tampered = blob.slice(0, -8) + (blob.endsWith("AAAA=") ? "BBBB=" : "AAAA=");
    expect(() => decryptState(keyA, tampered)).toThrow();
  });
});
