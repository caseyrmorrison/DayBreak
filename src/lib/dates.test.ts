import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDateKey,
  greetingFor,
  isConsecutive,
  isDateKey,
  toDateKey,
} from "./dates";

describe("toDateKey", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(toDateKey(new Date(2026, 6, 4))).toBe("2026-07-04");
    expect(toDateKey(new Date(2026, 0, 9))).toBe("2026-01-09");
  });
});

describe("isDateKey", () => {
  it("accepts real calendar dates", () => {
    expect(isDateKey("2026-07-04")).toBe(true);
    expect(isDateKey("2024-02-29")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    expect(isDateKey("garbage")).toBe(false);
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-7-4")).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
  });
});

describe("isConsecutive", () => {
  it("is true only for adjacent days", () => {
    expect(isConsecutive("2026-07-03", "2026-07-04")).toBe(true);
    expect(isConsecutive("2026-07-02", "2026-07-04")).toBe(false);
    expect(isConsecutive("2026-07-04", "2026-07-04")).toBe(false);
  });
});

describe("formatDateKey", () => {
  it("renders a human-readable date", () => {
    expect(formatDateKey("2026-07-04")).toBe("Saturday, July 4");
  });
});

describe("greetingFor", () => {
  it("matches the time of day", () => {
    expect(greetingFor(2)).toBe("Up late");
    expect(greetingFor(9)).toBe("Good morning");
    expect(greetingFor(14)).toBe("Good afternoon");
    expect(greetingFor(20)).toBe("Good evening");
  });
});
