/**
 * `next.config.ts` is loaded before path aliases exist, so everything it imports — and everything
 * those import — must use relative paths. An `@/` or `@server/` there passes tsc and every unit test
 * and fails only `next build` ("Cannot find module"), as `security-headers.ts` did on 2026-11-05.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+"([^"]+)"/g;

function resolveModule(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate) && candidate.endsWith(".ts")) return candidate;
  }
  return null;
}

function aliasedImports(entry: string): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const [, spec] of readFileSync(file, "utf8").matchAll(IMPORT)) {
      if (/^(@\/|@server\/|~\/)/.test(spec)) found.push(`${relative(ROOT, file)} imports "${spec}"`);
      else if (spec.startsWith(".")) {
        const next = resolveModule(file, spec);
        if (next) visit(next);
      }
    }
  };
  visit(entry);
  return found;
}

describe("next.config.ts loads only relative imports", () => {
  it("has no path alias anywhere in what it loads", () => {
    expect(aliasedImports(join(ROOT, "next.config.ts"))).toEqual([]);
  });
});
