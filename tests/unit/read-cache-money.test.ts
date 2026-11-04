/**
 * Money is never read from the shared cache (ADR-0065 decision 1; Invariants 1, 2 and 6). A display
 * read may be minutes old; a charged price, a payment or a stock decision may not. This fails if any
 * module on the money path imports the cache seam or a display context.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const MONEY_PATHS = [
  "server/checkout",
  "server/cart",
  "server/payments",
  "server/payouts",
  "server/promotions",
  "src/app/api/checkout",
  "src/app/api/cart",
  "src/app/api/payments",
  "src/app/api/webhooks",
];
/** The one file allowed to name the display context: where it is defined. */
const DEFINED_HERE = new Set(["server/promotions/price-context.ts"]);
const FORBIDDEN = /\b(cachedRead|loadDisplayPriceContext|loadDisplayBiddingLockContext)\b|@server\/shared\/read-cache/;

function files(dir: string): string[] {
  const abs = join(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(abs, name);
    if (statSync(path).isDirectory()) return files(relative(ROOT, path));
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [relative(ROOT, path)] : [];
  });
}

describe("the money path reads live", () => {
  const scanned = MONEY_PATHS.flatMap(files);

  it("scans something", () => {
    expect(scanned.length).toBeGreaterThan(40);
  });

  it("never touches the shared read cache or a display context", () => {
    const offenders = scanned
      .filter((file) => !DEFINED_HERE.has(file))
      .filter((file) => FORBIDDEN.test(readFileSync(join(ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });
});
