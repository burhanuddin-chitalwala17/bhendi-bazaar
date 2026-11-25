/**
 * Sealed chat text stays where its shop's members read it (social-selling A-D12, ADR-0085): no admin
 * read model, analytics query or log line selects a sealed column. Arrived with the first one
 * (inbox-core unit 1); a new sealed column is added to SEALED in the same change.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

/** Every sealed column, and the one domain that may name it. */
const SEALED: Record<string, string> = {
  bodySealed: "server/inbox/",
  lastPreviewSealed: "server/inbox/",
};

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry) && !entry.endsWith(".d.ts")) out.push(relative(ROOT, path));
  }
  return out;
}

const files = [...sourceFiles(join(ROOT, "server")), ...sourceFiles(join(ROOT, "src")), ...sourceFiles(join(ROOT, "worker"))];
const names = (text: string, column: string) => new RegExp(`\\b${column}\\b`).test(text);
const LOG_CALL = /console\.\w+\(([^;]|\n)*?\);?/g;

describe("sealed columns (A-D12)", () => {
  it("scans the source it claims to check, and finds the columns' owner using them", () => {
    expect(files.length).toBeGreaterThan(300);
    for (const [column, home] of Object.entries(SEALED)) {
      expect(files.some((f) => f.startsWith(home) && names(readFileSync(f, "utf8"), column))).toBe(true);
    }
  });

  it("no file outside the owning domain names a sealed column: no admin page, analytics query or other domain reads one", () => {
    const offenders = files.flatMap((f) => {
      const text = readFileSync(f, "utf8");
      return Object.entries(SEALED)
        .filter(([column, home]) => !f.startsWith(home) && names(text, column))
        .map(([column]) => `${f}: ${column}`);
    });
    expect(offenders).toEqual([]);
  });

  it("inside it, no admin.* read model and no log call names one", () => {
    const offenders = files.flatMap((f) => {
      const text = readFileSync(f, "utf8");
      const admin = /(^|\/)admin\.[^/]*$/.test(f);
      return Object.keys(SEALED)
        .filter((column) => (admin && names(text, column)) || [...text.matchAll(LOG_CALL)].some(([call]) => names(call, column)))
        .map((column) => `${f}: ${column}`);
    });
    expect(offenders).toEqual([]);
  });

  it("only the inbox opens a sealed value: support reads through its live share there, never elsewhere (inbox-core D9)", () => {
    const openers = files.filter((f) => !f.startsWith("server/inbox/") && !f.startsWith("server/shared/seal/") && /\bseal\.open\(/.test(readFileSync(f, "utf8")));
    expect(openers).toEqual([]);
    expect(files.some((f) => f === "server/inbox/inbox-privacy.service.ts" && /\bseal\.open\(/.test(readFileSync(f, "utf8")))).toBe(true);
  });
});
