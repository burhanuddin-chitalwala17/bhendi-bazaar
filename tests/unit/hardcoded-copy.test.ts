/**
 * Words a person reads live in a copy module, and our own pages' paths in ROUTES (ADR-0067).
 * The backlog reached zero on 2026-11-05, so the rule is absolute: no file outside a copy module
 * or ROUTES carries a word a person reads, or a path to one of our pages.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");

/** Where copy and paths are allowed to be written: the modules that exist to hold them. */
const HOLDS_COPY = /(^|[-./])copy\.tsx?$|(^|\/)routes\.ts$/;

/** Text after a tag's closing `>`: not an arrow's (`=>`), a comparison's (` > `) or a generic's, whose run carries code. */
const JSX_TEXT = /(?<![=\s-])>\s*([A-Za-z](?:[^<>{};=&|]|&[a-z#0-9]+;)*?[a-z](?:[^<>{};=&|]|&[a-z#0-9]+;)*?)\s*</g;
/** The same run of words after an expression (`{n} Photos are…<`), which JSX_TEXT does not reach. */
const JSX_TEXT_AFTER_EXPRESSION = /\}\s*([A-Z][a-z]+ (?:[^<>{};=&|]|&[a-z#0-9]+;)*?[a-z](?:[^<>{};=&|]|&[a-z#0-9]+;)*?)\s*</g;
/** A quoted sentence anywhere — copy in a ternary, an object, a list or metadata. */
const SENTENCE = /(?<![\w-])(["'`])[A-Z][a-z']+(?: [A-Za-z0-9'’,.!?—–-]+)+\1/g;
/** Lines whose quoted words are not copy: class names, logs, thrown errors, imports. */
const NOT_COPY_LINE = /className|\bcn\(|console\.|throw new|Error\(|^\s*import |data-testid/;
/** Out of scope by ADR-0067 D3: schema messages and route handlers' fallback errors stay beside their rule. */
const SENTENCES_OUT_OF_SCOPE = /^src\/(app\/api|lib\/validation)\//;
/**
 * Quoted words that are deliberately not copy modules' to hold, each with its reason. Kept short:
 * an entry here is a decision, not a backlog.
 */
const SENTENCE_EXEMPT: Record<string, string> = {
  "src/lib/config.ts": "the brand's static facts (name, tagline, grievance officer); CLAUDE.md names config.ts their one home",
  "src/lib/admin-auth.ts": "a thrown UnauthorizedError's text stays beside the rule that throws it (D3)",
  "src/lib/rate-limit/registry.ts": "an exemption's reason, read by developers in the registry, never shown",
  "src/lib/rate-limit/limiter.ts": "log text",
  "src/components/storefront/theme-fonts.ts": "font family names, not words",
  "src/components/checkout/hooks/useCheckoutPayment.ts": "matches a gateway error's wording; never shown",
  "src/components/checkout/components/GuestAddress.tsx": "its Zod schema's messages stay with the schema (D3)",
};

const COPY_PROP = /\b(?:title|description|label|placeholder|aria-label|alt|emptyLabel|helperText|hint|confirmLabel|cancelLabel)="[^"]*[a-z][^"]*"/g;
const TOAST = /\btoast(?:\.\w+)?\(\s*["'`][^"'`]*[a-z]/g;
const ROUTE = /["'`]\/(?:org|admin|category|product|store|shop|cart|checkout|wishlist|offers|policies|signin|signup|sell|orders|order|profile|bid|s|forgot-password|reset-password)(?:[/?#"'`$]|$)/g;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name) ? [path] : [];
  });
}

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

export function countHardcoded(path: string): number {
  if (HOLDS_COPY.test(path)) return 0;
  const s = stripComments(readFileSync(path, "utf8"));
  let n = (s.match(TOAST) ?? []).length + (s.match(ROUTE) ?? []).length;
  if (path.endsWith(".tsx")) {
    n += (s.match(JSX_TEXT) ?? []).length + (s.match(JSX_TEXT_AFTER_EXPRESSION) ?? []).length + (s.match(COPY_PROP) ?? []).length;
  }
  const file = relative(ROOT, path);
  if (!SENTENCES_OUT_OF_SCOPE.test(file) && !(file in SENTENCE_EXEMPT)) {
    for (const raw of s.split("\n")) {
      const line = raw.replace(/\s\/\/\s.*$/, "");
      if (!NOT_COPY_LINE.test(line)) n += (line.match(SENTENCE) ?? []).length;
    }
  }
  return n;
}

function current(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const path of sources(join(ROOT, "src"))) {
    const n = countHardcoded(path);
    if (n > 0) out[relative(ROOT, path)] = n;
  }
  return out;
}

describe("copy lives in copy modules, paths in ROUTES (ADR-0067)", () => {
  it("leaves no hard-coded copy or route in any file", () => {
    const found = Object.entries(current()).map(([file, n]) => `${file}: ${n}`);
    expect(found, "Move the words to the area's *-copy.ts and the path to ROUTES (server/shared/routes.ts):\n  " + found.join("\n  ")).toEqual([]);
  });

  it("every exemption still names a file that exists", () => {
    const missing = Object.keys(SENTENCE_EXEMPT).filter((file) => {
      try {
        return !statSync(join(ROOT, file)).isFile();
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });
});
