/**
 * Server-by-default, enforced ([ADR-0034]).
 *
 * CLAUDE.md has said since the App Router migration that `"use client"` is earned by
 * interactivity and belongs on the smallest leaf. Under that rule the tree reached **106 of
 * 173 components under `src/components` (121 of 248 across all of `src/`), with ten client
 * `page.tsx` files and one client `layout.tsx`.**
 *
 * The cost is structural, not stylistic. A server component reads through
 * `src/data-access-layer/` and renders: two files. A client page cannot reach the database,
 * so the same screen becomes page → hook → client service → route handler → schema → domain:
 * six or seven. That is the mechanism behind a feature touching thirty files, and behind 93
 * route handlers of which several exist only so a client component could read what a server
 * component already could.
 *
 * A ratchet, for the reason in docs/TESTING.md: a gate that fails on day one with ten errors
 * gets suppressed. The allowlists shrink and never grow — **and both are now empty**, so the
 * rule holds outright: not one `page.tsx` or `layout.tsx` in the tree is a client component.
 * An empty allowlist is worth nothing on its own, so the first test below checks the scan
 * still reaches the files it claims to.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

/**
 * Pages that opt their whole subtree out of server rendering — empty, and it stays that way.
 *
 * An entry buys time for one conversion: keep the page a server component, move the
 * interactive part to a leaf, and read through the DAL instead of a route handler. Nothing
 * needs that time now, so adding a line here is reopening a debt that was paid.
 */
const CLIENT_PAGES: Record<string, string> = {};

/** Layouts that opt their subtree out. Same conversion as a page, wider blast radius. */
const CLIENT_LAYOUTS: Record<string, string> = {};

/**
 * There is deliberately no ceiling on the *number* of client components.
 *
 * One was tried and removed the same day: converting `admin/users` from a client page into a
 * server page plus two client leaves — a filter bar and a table — is a strict improvement, and
 * it *raised* the component count by one. A count of files punishes the refactor it is meant
 * to encourage, because pushing `"use client"` down to the leaves necessarily creates leaves.
 *
 * What matters is the boundary, not the tally: a page or a layout must not opt its whole
 * subtree out of server rendering. That is unambiguous, it cannot be satisfied by moving code
 * around, and it is what the two assertions below hold.
 */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

const isClient = (f: string) => /^\s*["']use client["']/m.test(readFileSync(f, "utf8"));

const appFiles = tsxFiles(join(ROOT, "src/app"));
const componentFiles = tsxFiles(join(ROOT, "src/components"));

describe("render on the server by default", () => {
  it("the scan reaches the files it claims to check", () => {
    expect(appFiles.length, "no .tsx under src/app").toBeGreaterThan(40);
    expect(componentFiles.length, "no .tsx under src/components").toBeGreaterThan(50);
    // With both allowlists empty every other assertion would also pass on a scan that found
    // no pages at all, so the pages themselves are counted, not just the files.
    expect(appFiles.filter((f) => /\/page\.tsx$/.test(f)).length).toBeGreaterThan(20);
    expect(appFiles.filter((f) => /\/layout\.tsx$/.test(f)).length).toBeGreaterThan(3);
    // And the scan must be able to recognise a client component when it sees one.
    expect(componentFiles.filter(isClient).length).toBeGreaterThan(20);
  });

  it("no page is a client component", () => {
    const offenders = appFiles
      .filter((f) => /\/page\.tsx$/.test(f))
      .filter(isClient)
      .map((f) => relative(ROOT, f))
      .filter((f) => !(f in CLIENT_PAGES));

    expect(
      offenders,
      '`"use client"` on a page opts its whole subtree out of server rendering, and every read ' +
        "it needs then has to travel through a route handler. Keep the page a server component " +
        "and move the interactive part to a leaf:\n" + offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("no layout is a client component", () => {
    // Wider blast radius than a page: a client layout takes every route beneath it with it.
    const offenders = appFiles
      .filter((f) => /\/layout\.tsx$/.test(f))
      .filter(isClient)
      .map((f) => relative(ROOT, f))
      .filter((f) => !(f in CLIENT_LAYOUTS));
    expect(
      offenders,
      "A client layout opts every route beneath it out of server rendering:\n" +
        offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("the client-page allowlist only shrinks", () => {
    const live = new Set(
      appFiles.filter((f) => /\/page\.tsx$/.test(f)).filter(isClient).map((f) => relative(ROOT, f)),
    );
    const stale = Object.keys(CLIENT_PAGES).filter((k) => !live.has(k));
    expect(
      stale,
      "Converted to server components — remove them so the ratchet tightens:\n" +
        stale.map((s) => `    ${s}`).join("\n"),
    ).toEqual([]);
  });

  it("every allowlisted page says what its conversion needs", () => {
    const vague = Object.entries(CLIENT_PAGES).filter(([, why]) => why.trim().length < 40);
    expect(vague.map(([k]) => k), "A reason short enough to be a shrug is not a reason.").toEqual([]);
  });

});
