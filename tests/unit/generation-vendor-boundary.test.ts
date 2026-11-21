/**
 * Only an adapter knows a provider exists (generation-foundation trd D2, D5; ai-images Q5, Q6). A
 * provider's host or one of the generation credentials named anywhere else is a second place that
 * must change when a provider does — the coupling the port exists to prevent.
 *
 * Mutation-tested 2026-11-21 (ADR-0056): adding `"https://api.cloudflare.com"` to
 * `server/content/generation/router.ts` and `process.env.IMAGE_GEN_CLOUDFLARE_API_TOKEN` to
 * `server/content/providers/scene/generated.ts` each turned this red; reverted, green.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const ADAPTERS = "server/content/generation/adapters/";

/** What only an adapter may say. */
const VENDOR_MARKS = [
  /api\.cloudflare\.com/,
  /generativelanguage\.googleapis\.com/,
  /\bfal\.run\b/,
  /IMAGE_GEN_CLOUDFLARE_ACCOUNT_ID/,
  /IMAGE_GEN_CLOUDFLARE_API_TOKEN/,
  /IMAGE_GEN_GEMINI_API_KEY/,
];

/**
 * Files outside `adapters/` that may, each with its reason. Shrinks only (ADR-0056).
 */
const ALLOWED: Record<string, string> = {
  "server/content/providers/model-host.ts":
    "fal's default host for the cut-out service, which predates the port and moves onto it when segmentation does",
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

const scanned = [...sourceFiles(join(ROOT, "server")), ...sourceFiles(join(ROOT, "src")), ...sourceFiles(join(ROOT, "scripts"))];

describe("the generation vendor boundary", () => {
  it("scans the code it claims to, adapters included", () => {
    expect(scanned.length).toBeGreaterThan(500);
    expect(scanned.filter((f) => f.startsWith(ADAPTERS)).length).toBeGreaterThanOrEqual(4);
  });

  it("finds each mark in an adapter, so a mark that matches nothing cannot pass vacuously", () => {
    const adapterText = scanned.filter((f) => f.startsWith(ADAPTERS)).map((f) => readFileSync(f, "utf8")).join("\n");
    const hostText = readFileSync("server/content/providers/model-host.ts", "utf8");
    for (const mark of VENDOR_MARKS) expect(mark.test(adapterText) || mark.test(hostText), String(mark)).toBe(true);
  });

  it("keeps every provider host and credential inside the adapters", () => {
    const offenders: string[] = [];
    for (const file of scanned) {
      if (file.startsWith(ADAPTERS) || ALLOWED[file]) continue;
      const text = readFileSync(file, "utf8");
      for (const mark of VENDOR_MARKS) if (mark.test(text)) offenders.push(`${file} → ${mark}`);
    }
    expect(offenders).toEqual([]);
  });

  it("allows nothing it no longer needs to", () => {
    for (const file of Object.keys(ALLOWED)) {
      const text = readFileSync(file, "utf8");
      expect(VENDOR_MARKS.some((mark) => mark.test(text)), file).toBe(true);
    }
  });
});
