/**
 * The ticket engine knows no module (setup-requests D4, Q33). Its core files import no channel,
 * listing or catalog code beyond catalog's product names, and name no marketplace and no kind: a kind
 * plugs in through `kinds/index.ts`, and a source of needs through its own folder. A new module's
 * tickets are a folder and a registry line, never an edit to the engine.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** The engine: everything in `server/requests` except the plug-in folders. */
const CORE = [
  "server/requests/request.service.ts",
  "server/requests/request.types.ts",
  "server/requests/ticket.repository.ts",
  "server/requests/requests.job.ts",
  "server/requests/requests.jobs.ts",
  "server/requests/kinds/kind.ts",
  "server/requests/kinds/issue.kind.ts",
];

describe("the ticket engine is decoupled from every module", () => {
  it.each(CORE)("%s imports no channel or listing code", (file) => {
    expect(read(file)).not.toMatch(/@server\/(channels|listing)\//);
  });

  it.each(CORE)("%s names no marketplace and no kind", (file) => {
    const code = read(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toMatch(/amazon|flipkart|meesho|marketplace|CHANNEL\b|channel\b/i);
  });

  it("the engine's shop and admin screens name no kind", () => {
    for (const file of ["src/app/(admin)/admin/requests/page.tsx", "src/app/(admin)/admin/requests/[id]/page.tsx", "src/app/(org)/org/[orgId]/requests/page.tsx", "src/components/requests/your-requests.tsx"]) {
      expect(read(file), file).not.toMatch(/amazon|MARKETPLACE_KIND|marketplace\//i);
    }
  });
});
