/**
 * The shop portal says "shop" (own-store onboarding D14, Q7, spec A7). Comments are stripped, so
 * only words a seller can read are judged; org-profile U5 extends the list.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "console" ? [] : files(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** Source with comments removed, so a code note about an "organisation" is not copy. */
function visible(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    // The HTML autofill token, not a word anyone reads.
    .replace(/autoComplete="organization"/g, "");
}

/** Every seller-facing file: the portal's pages, the shop's components, the shell around them. */
const PORTAL = [
  ...files("src/app/(org)"),
  ...files("src/components/org"),
  "src/components/layout/OrgSidebar.tsx",
  "src/components/layout/org-tab-bar.tsx",
  "src/components/layout/portal-nav.ts",
  "src/components/layout/portal-copy.ts",
  "src/components/layout/PortalHeader.tsx",
];

/** The screens unit 1 owns; nothing on them is ever disabled (ADR-0053, spec R11). */
const NEVER_DISABLED = [
  "src/components/layout/PortalSidebar.tsx",
  "src/components/layout/OrgSidebar.tsx",
  "src/components/layout/org-tab-bar.tsx",
  "src/components/org/storefront-banners-manager.tsx",
  "src/components/org/add-promotion-dialog.tsx",
  "src/components/org/shop-hub/shop-link-card.tsx",
  "src/app/(org)/org/[orgId]/shop/page.tsx",
];

describe("portal copy", () => {
  it("scans the seller-facing files", () => {
    expect(PORTAL.length).toBeGreaterThan(40);
  });

  it('never calls the shop an "organisation" (Q7)', () => {
    const hits = PORTAL.filter((file) => /organi[sz]ation/i.test(visible(file)));
    expect(hits).toEqual([]);
  });

  it('names the banner card "Banners", not "Promotions" (spec A7)', () => {
    const banners = visible("src/components/org/storefront-banners-manager.tsx");
    expect(banners).toContain("<CardTitle>Banners</CardTitle>");
    expect(banners).not.toMatch(/\bPromotions?\b(?!Dialog)/);
  });

  it("disables nothing on these screens (spec A7, R11)", () => {
    const hits = NEVER_DISABLED.filter((file) => /\bdisabled\b/.test(visible(file)));
    expect(hits).toEqual([]);
  });
});
