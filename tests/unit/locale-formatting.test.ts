// A date or count formatted by the runtime prints different text on the server (UTC, en-US) and in
// the browser (IST, en-IN), and React's hydration fails. It recurred in three admin tables before
// this gate; every date and count now goes through the pinned helpers in `src/lib/format.ts`.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const HOME = "src/lib/format.ts";

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

describe("dates and counts are formatted in one locale and one zone", () => {
  const files = sources(join(ROOT, "src")).map((p) => relative(ROOT, p));

  it("the scan reaches the files it claims to check", () => {
    expect(files).toContain(HOME);
    expect(files.length).toBeGreaterThan(200);
  });

  it("nothing outside format.ts asks the runtime for its locale", () => {
    const offenders = files
      .filter((p) => p !== HOME)
      .filter((p) => /\.toLocale(?:Date|Time)?String\(/.test(readFileSync(join(ROOT, p), "utf8")))
      .sort();

    expect(
      offenders,
      "Use formatDay / formatShortDate / formatDateTime / formatDate / formatCount from " +
        `${HOME}, which pin en-IN and Asia/Kolkata:\n${offenders.map((o) => `    ${o}`).join("\n")}`,
    ).toEqual([]);
  });
});
