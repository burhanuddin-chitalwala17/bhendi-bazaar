/**
 * Every request body is parsed, never cast (Invariant 4).
 *
 * `as SomeType` on `await request.json()` is a compile-time fiction: it changes what the
 * compiler believes and nothing about what arrived. The body is whatever the caller sent, and
 * after the cast every field reads as trusted — which is how a server-owned field like
 * `paymentStatus` or a computed total gets spread into a Prisma `data` argument.
 *
 * This file exists because the rule had no enforcement. Replacing a handler's
 * `schema.parse(await request.json())` with `(await request.json()) as T` passed the whole
 * suite: 1233 tests, a route reading an unvalidated body, nothing red. CLAUDE.md has called
 * that a hard block since the App Router migration and only prose was holding it.
 *
 * Two rules, because either alone is escapable. A body may not be cast, and a handler that
 * reads one must validate it — `validateRequest`, a Zod `parse`/`safeParse`, or a named schema
 * — in the same file. Neither can see through a helper that takes `unknown` and asserts, which
 * is why `no-explicit-any` and the review checklist still matter; they catch different things.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function routeFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\/route\.ts$/.test(p)) out.push(p);
    }
  };
  walk(join(ROOT, "src/app/api"));
  return out;
}

const handlers = routeFiles().map((f) => ({
  path: relative(ROOT, f),
  text: readFileSync(f, "utf8"),
}));

/** Handlers that read a body at all. A GET-only route has nothing to validate. */
const withBody = handlers.filter((h) => /\b(?:request|req)\.json\(\)/.test(h.text));

/** A cast applied to the body, however the call is spelled or wrapped. */
const CAST_ON_BODY =
  /(?:await\s+)?\(?\s*await\s+(?:request|req)\.json\(\)\s*\)?\s*as\s+(?!const\b)\w/;

describe("a request body is parsed, never cast (Invariant 4)", () => {
  it("the scan reaches the handlers it claims to check", () => {
    // An empty offender list over an empty scan is the failure mode this whole file is about.
    expect(handlers.length).toBeGreaterThan(50);
    expect(withBody.length).toBeGreaterThan(30);
  });

  it("no handler casts the body instead of parsing it", () => {
    const offenders = withBody.filter((h) => CAST_ON_BODY.test(h.text)).map((h) => h.path);

    expect(
      offenders,
      "`as T` on `await request.json()` asserts a shape rather than checking one, and the " +
        "runtime keeps whatever the caller actually sent. Parse it with a schema from " +
        "src/lib/validation/schemas/:\n" + offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("every handler that reads a body validates it", () => {
    const VALIDATES = /\.(?:safeParse|parse)\(|validateRequest\(|\bSchema\.\w+\(/;
    const offenders = withBody.filter((h) => !VALIDATES.test(h.text)).map((h) => h.path);

    expect(
      offenders,
      "This handler reads a body and never validates it, so every field in it is whatever the " +
        "caller chose to send:\n" + offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("no handler spreads a request body into a Prisma write", () => {
    // The concrete harm the two rules above prevent, asserted directly: mass assignment.
    // A write path whitelists its fields; `...body` whitelists everything the caller sent.
    const offenders = handlers
      .filter((h) => /data:\s*\{\s*\.\.\.(?:body|json|payload|input)\b/.test(h.text))
      .map((h) => h.path);

    expect(
      offenders,
      "Spreading a parsed body into `data` hands the caller every column the schema did not " +
        "think to forbid. Name the fields:\n" + offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });
});
