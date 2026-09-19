/**
 * An org's public address (org-handle spec, ADR-0030 decision 4).
 *
 * The rules worth pinning are the ones a printed card depends on: a handle is derived
 * from the name, never collides with a path the platform serves, survives a name that
 * is not Latin script, and stays held for exactly as long as the window says before it
 * returns to the pool.
 */
import { describe, expect, it } from "vitest";
import {
  HANDLE_HOLD_DAYS,
  handleCandidates,
  holdCutoff,
  holdExpiresAt,
  isHeld,
  isReservedHandle,
} from "@server/catalog/org.handle";

const firstFew = (name: string, n = 3) => {
  const out: string[] = [];
  for (const candidate of handleCandidates(name)) {
    out.push(candidate);
    if (out.length === n) break;
  }
  return out;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("a handle is derived from the name", () => {
  it("reads as the shop does", () => {
    expect(firstFew("Naaz Collection", 1)).toEqual(["naaz-collection"]);
  });

  it("offers numbered alternatives for a name someone else already took", () => {
    expect(firstFew("Naaz Collection")).toEqual([
      "naaz-collection",
      "naaz-collection-2",
      "naaz-collection-3",
    ]);
  });

  it("collapses punctuation and spacing rather than encoding it", () => {
    expect(firstFew("  A&B  Traders (Pvt) Ltd. ", 1)).toEqual(["a-b-traders-pvt-ltd"]);
  });

  it("folds accents to their base letters", () => {
    expect(firstFew("Café Noir", 1)).toEqual(["cafe-noir"]);
  });

  it.each([
    ["شمع", "a name in another script"],
    ["…", "a name that is only punctuation"],
    ["", "no name at all"],
  ])("still yields a usable handle for %s (%s)", (name) => {
    const [first] = firstFew(name, 1);
    expect(first).toMatch(SLUG);
    expect(first.length).toBeGreaterThan(0);
  });

  it("never yields anything a route param could not carry", () => {
    for (const name of ["Ünïcødé Shop", "50% Off!!", "___", "a".repeat(80)]) {
      for (const candidate of firstFew(name)) expect(candidate).toMatch(SLUG);
    }
  });
});

describe("a handle never collides with a path the platform serves", () => {
  it.each(["admin", "api", "org", "store", "checkout", "signin", "about", "new"])(
    "%s is reserved",
    (word) => {
      expect(isReservedHandle(word)).toBe(true);
    }
  );

  it("skips a reserved word entirely rather than suffixing it", () => {
    // `admin-2` still reads as a platform page, so the whole word is passed over.
    const candidates = firstFew("Admin", 2);
    expect(candidates).not.toContain("admin");
    expect(candidates[0]).toBe("admin-2");
  });

  it("leaves an ordinary name alone", () => {
    expect(isReservedHandle("naaz-collection")).toBe(false);
  });
});

describe("a retired handle is held, then released", () => {
  const now = new Date("2026-09-19T12:00:00.000Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  it("holds one retired today", () => {
    expect(isHeld(daysAgo(0), now)).toBe(true);
  });

  it("still holds one retired the day before the window closes", () => {
    expect(isHeld(daysAgo(HANDLE_HOLD_DAYS - 1), now)).toBe(true);
  });

  it("releases one retired a day past the window", () => {
    expect(isHeld(daysAgo(HANDLE_HOLD_DAYS + 1), now)).toBe(false);
  });

  it("puts the cutoff exactly one window behind now", () => {
    const expected = now.getTime() - HANDLE_HOLD_DAYS * 24 * 60 * 60 * 1000;
    expect(holdCutoff(now).getTime()).toBe(expected);
  });

  it("tells an owner the date their old address stops working", () => {
    const retired = new Date("2026-01-01T00:00:00.000Z");
    const expires = holdExpiresAt(retired);
    const days = (expires.getTime() - retired.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(HANDLE_HOLD_DAYS);
  });

  it("is a setting, not a literal", () => {
    // ADR-0030: the window is the only thing between a printed card and a customer
    // arriving at a different shop, so it has to be tunable without a code change.
    expect(HANDLE_HOLD_DAYS).toBeGreaterThan(0);
    expect(Number.isFinite(HANDLE_HOLD_DAYS)).toBe(true);
  });
});
