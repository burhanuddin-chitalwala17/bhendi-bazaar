// A component renders, a hook holds state, an API client makes the call (ADR-0048).
// No allowlist: when this was written, every one of the 57 inline requests was classified
// and none needed to own its request, so an exception list would only record unfinished work.
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(relative(ROOT, path));
  }
  return out;
}

// Route handlers run on the server and may call third parties; the rule is about the browser.
const CLIENT_FILES = sourceFiles(join(ROOT, "src")).filter((f) => !f.startsWith("src/app/api/"));

/** The only modules that may call `fetch` in client code, and why. */
const REQUEST_MODULES: Record<string, string> = {
  "src/lib/api-client.ts": "apiRequest — the one place the browser calls our API.",
  "src/lib/image/upload-direct.ts": "The presigned PUT to the object store, which is not our API.",
  "src/components/org/mediaFilesApiClient.ts":
    "The presigned GET of a library file for the browser's zip (bulk-actions D7): the bucket answers bytes, not our envelope.",
};

const CALLS_FETCH = /(?<![\w.$])fetch\s*\(/;

describe("the browser calls our API through an API client", () => {
  it("scans the client source it claims to check", () => {
    expect(CLIENT_FILES.filter((f) => f.startsWith("src/components/")).length).toBeGreaterThan(150);
    for (const file of Object.keys(REQUEST_MODULES)) expect(existsSync(file), file).toBe(true);
  });

  it("no component, hook, context or store calls fetch", () => {
    const offenders = CLIENT_FILES.filter(
      (f) => !(f in REQUEST_MODULES) && CALLS_FETCH.test(readFileSync(f, "utf8")),
    );
    expect(
      offenders,
      "Move the request into the domain's *ApiClient.ts and call it from a hook " +
        "(useServerForm, useMutation, useAsyncData). ADR-0048.",
    ).toEqual([]);
  });

  it("an API client lives beside its domain's components, not in a layer folder", () => {
    expect(existsSync("src/services"), "src/services/ was dissolved into src/components/<domain>/").toBe(false);
    const misplaced = CLIENT_FILES.filter((f) => /ApiClient\.ts$/.test(f) && !/^src\/components\/[a-z-]+\//.test(f));
    expect(misplaced).toEqual([]);
  });

  it("a client-side wrapper is named for what it is", () => {
    // ADR-0003 D4: `*Service` is the server's word; a browser wrapper is an `*ApiClient`.
    expect(CLIENT_FILES.filter((f) => /Service\.tsx?$/.test(f))).toEqual([]);
  });

  it("an API client sends through apiRequest and leaves toasts and navigation to its caller", () => {
    const clients = CLIENT_FILES.filter((f) => /ApiClient\.ts$/.test(f));
    expect(clients.length).toBeGreaterThan(10);
    const bad = clients.filter((f) => {
      const source = readFileSync(f, "utf8");
      // A client listed above reads a store that is not our API, so it cannot send through apiRequest.
      const ours = !(f in REQUEST_MODULES);
      return (ours && !source.includes("apiRequest")) || /from "sonner"|from "next\/navigation"/.test(source);
    });
    expect(bad).toEqual([]);
  });
});
