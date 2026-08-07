// A 57-file rename stays done only if something checks. "Seller" became "Org" in
// PR-23; without this, the next person to add a vendor-facing feature reintroduces the
// old word in one file and nothing notices until the vocabulary has drifted again —
// which is how `ProductFlag` came to be declared three times.
//
// Prisma migrations are exempt: they are an applied history and must never be edited.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "server", "prisma"];
const SKIP_DIRS = new Set(["migrations", "node_modules", ".next"]);
const EXTS = [".ts", ".tsx"];

/** Retired words, and what replaced them. */
const RETIRED: Record<string, string> = {
  seller: "org",
};

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (EXTS.some((e) => entry.endsWith(e))) out.push(path);
  }
  return out;
}

describe("retired vocabulary does not come back", () => {
  for (const [retired, replacement] of Object.entries(RETIRED)) {
    it(`"${retired}" appears nowhere in source — use "${replacement}"`, () => {
      const offenders: string[] = [];
      const pattern = new RegExp(retired, "i");

      for (const root of ROOTS) {
        for (const file of sourceFiles(root)) {
          readFileSync(file, "utf8")
            .split("\n")
            .forEach((line, i) => {
              if (pattern.test(line)) offenders.push(`${file}:${i + 1}`);
            });
        }
      }

      expect(offenders).toEqual([]);
    });
  }

  it("also catches it in a path, not just an identifier", () => {
    expect(/seller/i.test("src/admin/sellersContainer/index.tsx")).toBe(true);
    expect(/seller/i.test("src/admin/orgsContainer/index.tsx")).toBe(false);
  });
});
