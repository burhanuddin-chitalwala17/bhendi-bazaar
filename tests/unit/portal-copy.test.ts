/**
 * The shop portal says "shop" (own-store onboarding D14, Q7, spec A7). Comments are stripped, so
 * only words a seller can read are judged. org-profile U5 (R8, A4; D9) adds the old form labels,
 * placeholders and the org code.
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

/** org-profile A4: labels and placeholders from the old org forms, matched as whole words. */
const RETIRED_WORDS = [
  /\bDescription\b/,
  /\bIntroduction\b/,
  /\bBusiness Name\b/,
  /\bAccent\b/,
  /\bContact Person\b/,
  /\bBlock 1 heading\b/i,
  /John Doe/,
  /org@example\.com/,
  /ABC Traders/,
];

/** Any way the shop's code is reached: `org.code`, `currentOrg.code`, `o.code`, `data.orgCode`. */
const CODE_REF = String.raw`(?:\b(?:o|org\w*|current\w*|shop\w*|selected\w*)\??\.code\b|\borgCode\b)`;

/**
 * The org code shown to the shop: inside a `${...}` interpolation, a JSX text child
 * (`{org.code}` after `>` or `}`), or handed to a coupon prefix. A prop like
 * `orgCode={org.code}` feeding a storage path is not shown; an order code is not the org's.
 */
const ORG_CODE_SHOWN = new RegExp(
  String.raw`\$\{[^}]*${CODE_REF}[^}]*\}` +
    String.raw`|(?<=(?:(?<!=)>|\})[^<>{}=;,]*)\{[^{}=]*${CODE_REF}[^{}]*\}` +
    String.raw`|codePrefix=`,
);

/** Ratchet (ADR-0056): shrinks only. Each entry still shows the code, with the reason it may. */
const ORG_CODE_ALLOWED: Record<string, string> = {
  "src/app/(org)/org/[orgId]/promotions/new/page.tsx":
    "coupon codes start with the org code (promotions D13); kept by org-profile Q28",
  "src/app/(org)/org/[orgId]/promotions/[id]/edit/page.tsx": "same coupon prefix, org-profile Q28",
};

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

  it("uses none of the old form labels or placeholders (org-profile A4)", () => {
    const hits = PORTAL.flatMap((file) =>
      RETIRED_WORDS.filter((word) => word.test(visible(file))).map((word) => `${file} ${word}`),
    );
    expect(hits).toEqual([]);
  });

  it("never renders the org code (org-profile R8, A4; D9)", () => {
    const hits = PORTAL.filter((file) => ORG_CODE_SHOWN.test(visible(file)));
    expect(hits.filter((file) => !(file in ORG_CODE_ALLOWED))).toEqual([]);
    // An entry that no longer shows the code leaves the list.
    expect(Object.keys(ORG_CODE_ALLOWED).filter((file) => !hits.includes(file))).toEqual([]);
  });

  it("keeps the code out of what the shop switcher is sent (org-profile R8)", () => {
    expect(visible("src/components/org/org-switcher.tsx")).not.toMatch(/\bcode\b/);
  });
});
