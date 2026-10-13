// Measurements were read back through the *fact* parser, whose keys are facts; a measurement key
// failed it, the defensive parse returned `{}`, and every edit form opened with its dimensions blank.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseStoredMeasurements } from "@server/listing/listing-facts";

// The column as the dev database stores it for a real abaya.
const STORED = {
  hip: { value: 36, origin: "product" },
  bust: { value: 32, origin: "product" },
  waist: { value: 28, origin: "product" },
  length: { value: 58, origin: "product" },
  sleeve: { value: 14, origin: "product" },
  shoulder: { value: 30, origin: "product" },
};

describe("a product's measurements survive being read back", () => {
  it("parses a stored measurements column into its values", () => {
    const parsed = parseStoredMeasurements(STORED);
    expect(parsed.bust?.value).toBe(32);
    expect(Object.keys(parsed)).toHaveLength(6);
  });

  it("nothing reads a measurements column through the fact parser", () => {
    const root = resolve(__dirname, "../..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(p)) files.push(p);
      }
    };
    walk(join(root, "src"));
    walk(join(root, "server"));
    expect(files.length).toBeGreaterThan(300);

    const offenders = files.filter((p) =>
      /parseStoredFacts\([^)]*measurements/.test(readFileSync(p, "utf8")),
    );
    expect(offenders, "Use parseStoredMeasurements for a measurements column").toEqual([]);
  });
});
