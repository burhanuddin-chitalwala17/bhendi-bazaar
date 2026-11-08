/**
 * A product's answers live in the value rows since the switch (listing-model/dynamic-form Q16). The frozen
 * pre-switch copy on Product is read only by the compare gate and dropped by retire-old-paths; nothing else
 * may read or write it, or the two would drift and an answer could be lost.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["server", "src", "worker"];
const ALLOWED = new Set(["scripts/attributes-compare.ts"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("answers live in the value rows", () => {
  it("nothing outside the compare gate touches the frozen columns", () => {
    const all = ROOTS.flatMap(files);
    expect(all.length).toBeGreaterThan(500);
    const offenders = all.filter((f) => !ALLOWED.has(f) && /\b(factsFrozen|measurementsFrozen)\b/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("no raw query or JSON-path filter reads the frozen columns, which the type checker cannot see", () => {
    const raw = /jsonb_each\(\w*\.?"?(facts|measurements)"?\)|\w\."?(facts|measurements)"?\s*(IS |->>?|<>)|"(facts|measurements)"\s*(->>?|\?(?!\?)| IS )|SELECT "?(facts|measurements)\b|\b(facts|measurements): \{\s*(path|equals|not):/;
    expect(ROOTS.flatMap(files).filter((f) => raw.test(readFileSync(f, "utf8")))).toEqual([]);
  });

  it("only listing's value repository writes ProductValue", () => {
    const writers = ROOTS.flatMap(files).filter((f) => /\.productValue\.(create|update|upsert|delete)|(INSERT INTO|UPDATE|DELETE FROM) "ProductValue"|bb_write_answers|bb_write_inherited|bb_rederive_answers/.test(readFileSync(f, "utf8")));
    expect(writers).toEqual(["server/listing/product-value.repository.ts"]);
  });
});
