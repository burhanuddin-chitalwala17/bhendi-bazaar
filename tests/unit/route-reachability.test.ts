/**
 * Every route handler has a caller.
 *
 * A route handler exists for something a browser must do — a mutation, or a fetch triggered by
 * interaction. When a page converts from `"use client"` to a server component ([ADR-0034]) its
 * listing stops travelling through a route, and the handler it used stays behind: still routed,
 * still `requirePlatformAdmin`-gated, answering to nobody. Five did, plus a `PATCH` on
 * `/api/admin/users/[id]` that could set `platformRole` and had no screen behind it. Unreachable
 * code with that much authority is surface, not a feature, and nothing in the build complains
 * about it: a route's only caller is a string in another file, which no compiler follows.
 *
 * So this follows it. Call sites are the `/api/...` strings in the app's own source, with
 * `${...}` treated as one path segment and a `baseUrl`-style field substituted in, plus the paths
 * `vercel.json` schedules. Anything a caller outside the repository reaches — a gateway's
 * webhook, a link in an email — is named in `EXTERNALLY_CALLED` with who calls it.
 *
 * The allowlist may shrink. A new entry needs a caller that genuinely is not in this repository.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

/** Routes whose caller is not in this repository. Each says who calls it. */
const EXTERNALLY_CALLED: Record<string, string> = {
  "/api/webhooks/razorpay": "Razorpay posts here; the signature is what authenticates it.",
  "/api/webhooks/meta/instagram": "Meta posts Instagram events and checks the subscription here; the signature authenticates it (ADR-0078).",
  "/api/channels/instagram/deauthorize": "Meta posts here when a shop removes our app inside Instagram; the signed request authenticates it.",
  "/api/channels/meta/data-deletion": "Meta posts a person's data deletion request here; the signed request authenticates it.",
  "/api/webhooks/meta/whatsapp": "Meta posts WhatsApp events and checks the subscription here; the signature authenticates it (ADR-0078).",
  "/api/webhooks/shipping/courier": "Shiprocket posts tracking updates here (its settings refuse a URL naming it).",
  "/api/auth/verify-email": "The link in the verification email.",
  "/api/auth/[...nextauth]": "next-auth's own handler, reached by its client.",
  "/feeds/google.xml": "Google Merchant Center fetches it on the schedule its data source sets.",
  "/feeds/meta.xml": "Meta Commerce Manager fetches it on the schedule its data feed sets.",
  "/api/health": "The uptime monitor (UptimeRobot) probes it; ?deep=1 also checks the database.",
  "/api/channels/instagram/callback": "Instagram redirects the shop here after sign-in; the signed state authenticates it (connect-instagram D1).",
  "/api/channels/[channel]/callback": "Amazon and Flipkart redirect the shop here after consent; the signed state authenticates it (channel-connectors D4).",
};

/**
 * Routes that exist and nothing calls.
 *
 * Not an exemption — a worklist, and it is down to one. Nine entries were `GET`s orphaned when
 * their screen became a server component; those files are deleted. What is left is a feature
 * that was built and never given a screen, which is a decision rather than a deletion.
 *
 * **The list may shrink and must never grow.** A new orphan means deleting the handler, not
 * writing a line here.
 */
const UNREACHABLE: Record<string, string> = {
  "/api/admin/payouts/entries/[id]":
    "Correcting and removing an unsettled ledger entry, built with no screen behind it. " +
    "Either the console gets the control or the handlers go; an unreachable mutation on the " +
    "ledger is authority nobody can see.",
};

function walk(dir: string, match: (p: string) => boolean): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p, match));
    else if (match(p)) out.push(p);
  }
  return out;
}

const sourceFiles = walk(join(ROOT, "src"), (p) => /\.tsx?$/.test(p));
const routeFiles = sourceFiles.filter((p) => /\/route\.tsx?$/.test(p));
const callerFiles = sourceFiles.filter((p) => !p.includes("/src/app/api/"));

/** `src/app/api/admin/users/[id]/route.ts` → `/api/admin/users/[id]`. */
const urlOf = (file: string) =>
  "/" + relative(join(ROOT, "src/app"), file).replace(/\/route\.tsx?$/, "");

/**
 * The `/api/...` paths one file mentions, as segment-wise patterns.
 *
 * A `${...}` becomes `*` — one segment, contents unknown. A client that keeps its prefix in a
 * `baseUrl` and fetches `` `${this.baseUrl}/${id}/archive` `` never writes the whole path
 * anywhere, so a suffix is joined onto every prefix the same file declares. Over-joining is
 * safe here: an invented path matches no route, and the question asked is only whether a route
 * has *a* caller.
 */
function referencedPaths(text: string): string[] {
  const strings = [...text.matchAll(/["'`]([^"'`\n]*)["'`]/g)].map(([, value]) =>
    value.replace(/\$\{[^}]*\}/g, "*").replace(/[?#].*$/, "").replace(/\/+$/, ""),
  );
  const prefixes = strings.filter((value) => value.startsWith("/api/"));
  const suffixes = strings.filter((value) => value.startsWith("*/") && value.length > 2);
  return [
    ...prefixes,
    ...prefixes.flatMap((prefix) => suffixes.map((suffix) => prefix + suffix.slice(1))),
  ].filter(Boolean);
}

const patterns = new Set<string>();
for (const file of callerFiles) for (const p of referencedPaths(readFileSync(file, "utf8"))) patterns.add(p);
const vercelJson = join(ROOT, "vercel.json");
if (existsSync(vercelJson)) {
  for (const [, path] of readFileSync(vercelJson, "utf8").matchAll(/"(\/api\/[^"]*)"/g)) patterns.add(path);
}

/** A pattern reaches a route when it matches it segment for segment, `*` and `[param]` wild. */
function reaches(pattern: string, url: string): boolean {
  const a = pattern.split("/");
  const b = url.split("/");
  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg === "*" || /^\[.*\]$/.test(b[i]) || seg === b[i]);
}

describe("every route handler has a caller", () => {
  it("finds the call sites at all", () => {
    // If the scan breaks, everything looks unreachable and the assertion below turns into noise
    // pointing at 90 innocent files. A floor that the app plainly clears keeps that honest.
    expect(routeFiles.length).toBeGreaterThan(50);
    expect(patterns.size).toBeGreaterThan(40);
    expect([...patterns].some((p) => p.includes("*"))).toBe(true);
  });

  it("no route is unreachable", () => {
    const orphans = routeFiles
      .map(urlOf)
      .filter((url) => !(url in EXTERNALLY_CALLED) && !(url in UNREACHABLE))
      .filter((url) => ![...patterns].some((p) => reaches(p, url)));

    expect(
      orphans,
      "Nothing in this repository calls these, and no external caller is declared for them. " +
        "Delete the handler, or add it to EXTERNALLY_CALLED with who calls it:\n" +
        orphans.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("every allowlisted route still exists", () => {
    // An allowlist outliving the thing it excuses is how the next orphan gets waved through.
    const urls = new Set(routeFiles.map(urlOf));
    const stale = [...Object.keys(EXTERNALLY_CALLED), ...Object.keys(UNREACHABLE)].filter(
      (url) => !urls.has(url),
    );
    expect(stale, `Allowlisted but no longer a route:\n${stale.join("\n")}`).toEqual([]);
  });
});
