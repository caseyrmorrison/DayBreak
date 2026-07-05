import "@testing-library/jest-dom/vitest";
import { randomUUID, webcrypto } from "node:crypto";

const globals = globalThis as { crypto?: Crypto };

if (!globals.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
} else {
  if (typeof globals.crypto.randomUUID !== "function") {
    Object.defineProperty(globals.crypto, "randomUUID", {
      value: randomUUID,
      configurable: true,
    });
  }
  if (typeof globals.crypto.getRandomValues !== "function") {
    Object.defineProperty(globals.crypto, "getRandomValues", {
      value: webcrypto.getRandomValues.bind(webcrypto),
      configurable: true,
    });
  }
}

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
  });
}
