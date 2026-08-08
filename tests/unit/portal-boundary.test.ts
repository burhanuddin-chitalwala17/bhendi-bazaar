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

  it("the admin tree no longer mutates products — that moved to the owning org's portal", () => {
    expect(existsSync("src/app/api/admin/products")).toBe(false);
    expect(existsSync("src/app/(admin)/admin/products/new")).toBe(false);
  });
});
