// The portal split is a property of 37 surfaces, and a property that many files hold
// only if something checks it (portal-separation trd.md, test plan). The rules:
// anything under /api/admin answers to a platform admin; anything under /api/org
// answers to a membership via `withOrg`, which is the only thing that can hand a
// handler an org scope; and neither page tree borrows the other's authority.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

function files(dir: string, name?: string): string[] {
  if (!existsSync(dir)) return [];
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(files(path, name));
    else if (name ? entry === name : /\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

describe("portal boundaries", () => {
  it("the scan reaches the files it claims to check", () => {
    // Every assertion below is "this list of offenders is empty". A scan that finds no files
    // produces an empty list too, and passes — which is how a broken glob becomes a green
    // guard. The floor makes the two outcomes distinguishable.
    expect(files("src/app/api/admin", "route.ts").length).toBeGreaterThan(10);
    expect(files("src/app/api/org", "route.ts").length).toBeGreaterThan(5);
  });

  it("every /api/admin handler requires a platform admin", () => {
    const offenders = files("src/app/api/admin", "route.ts").filter(
      (f) => !readFileSync(f, "utf8").includes("requirePlatformAdmin")
    );
    expect(offenders).toEqual([]);
  });

  it("every /api/org handler is defined through withOrg", () => {
    const offenders = files("src/app/api/org", "route.ts").filter(
      (f) => !readFileSync(f, "utf8").includes("withOrg")
    );
    expect(offenders).toEqual([]);
  });

  it("org creation is the one org write outside withOrg, and it still requires a session", () => {
    // There is no org to be a member of yet — trd.md D6. If this file moves under
    // /api/org it gains a membership requirement it cannot satisfy.
    const source = readFileSync("src/app/api/orgs/route.ts", "utf8");
    expect(source).toContain("requireSession");
    // A call, not the word — the file's own comment names withOrg to explain itself.
    expect(source).not.toContain("withOrg(");
  });

  it("no platform page reaches for org authority or org-scoped reads", () => {
    const offenders = files("src/app/(admin)").filter((f) => {
      const source = readFileSync(f, "utf8");
      return source.includes("lib/org-auth") || source.includes("data-access-layer/org/");
    });
    expect(offenders).toEqual([]);
  });

  it("no org page reaches for platform authority", () => {
    const offenders = files("src/app/(org)").filter((f) =>
      readFileSync(f, "utf8").includes("requirePlatformAdmin")
    );
    expect(offenders).toEqual([]);
  });

  // The team may add and fix a shop's product (product-form D11, D12), but only on record: every
  // admin product write goes through the team service, which takes a reason and writes the audit
  // entry. A handler that called the catalog service directly would be an unrecorded edit.
  it("every admin product write is a team save, never a direct catalog write", () => {
    const writers = [
      ...files("src/app/api/admin/products", "route.ts"),
      ...files("src/app/api/admin/orgs/[id]/products", "route.ts").filter((f) => !f.includes("readiness")),
    ];
    expect(writers.length).toBeGreaterThanOrEqual(3);
    const offenders = writers.filter((f) => {
      const source = readFileSync(f, "utf8");
      // The bulk sheet's team service is the same rule for many rows: reason, one entry (own-store/bulk-sheet D11).
      return !/\b(productTeamService|bulkTeamService)\b/.test(source) || source.includes("admin.product.service");
    });
    expect(offenders).toEqual([]);
    // The team adds for a shop, never for nobody: there is no shop-less create page.
    expect(existsSync("src/app/(admin)/admin/products/new")).toBe(false);
  });
});
