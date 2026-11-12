// Rollover deletes history from the working tree, so it must refuse an unsummarised month and keep the PR high-water mark (ADR-0072).
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rollover } from "../../scripts/changelog-rollover.mjs";

const CURRENT = `# CHANGELOG

## 2026-11-02 — stray entry above the format

## Format
- Append-only.

## Entries

## [PR-9] 2026-11-01 — November

## 2026-10-31 — October late

## [PR-8] 2026-10-01 — October early
`;

function fixture(history: string) {
  const root = mkdtempSync(join(tmpdir(), "rollover-"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs/CHANGELOG.md"), CURRENT);
  writeFileSync(join(root, "docs/CHANGELOG-HISTORY.md"), history);
  return root;
}

const read = (root: string, f: string) => readFileSync(join(root, f), "utf8");
const TODAY = new Date("2026-11-12");

describe("changelog rollover", () => {
  it("refuses to drop a month that has no summary", () => {
    const root = fixture("- **Last PR number:** PR-7\n");
    expect(() => rollover(root, TODAY).apply()).toThrow(/2026-10/);
    expect(read(root, "docs/CHANGELOG.md")).toBe(CURRENT);
  });

  it("drops a summarised month, keeps the running month under Entries, records the highest PR", () => {
    const root = fixture("- **Last PR number:** PR-7\n\n## 2026-10\n\n- summary\n");
    expect(rollover(root, TODAY).closed).toEqual(["2026-10"]);
    rollover(root, TODAY).apply();
    const current = read(root, "docs/CHANGELOG.md");
    expect(current).not.toContain("October");
    expect(current.indexOf("## Entries")).toBeLessThan(current.indexOf("stray entry"));
    expect(read(root, "docs/CHANGELOG-HISTORY.md")).toContain("PR-8\n");
  });

  it("does nothing within the month", () => {
    expect(rollover(fixture(""), new Date("2026-10-31")).closed).toEqual([]);
  });
});
