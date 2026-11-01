// Design decisions reach the UI through semantic tokens (globals.css), never through
// literals at the call site. A literal pins one value in one place: it ignores the
// theme, and it turns a redesign into a hundred-file hunt while a rebrand stays a
// one-file edit. Colour was governed this way from PR-33; ADR-0022 extended the same
// treatment to type, tracking, elevation, and page width.
//
// Allowlists are for literals that are DATA or a third party's property, not styling.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CSS = readFileSync("src/app/globals.css", "utf8");

const RAW_PALETTE = new RegExp(
  "\\b(?:hover:|dark:|focus:|group-hover:)?" +
    "(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline)-" +
    "(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)" +
    "(?:-\\d+)?(?:/\\d+)?\\b",
  "g"
);

/** `text-[0.7rem]` and friends — a font size invented at the call site. */
const ARBITRARY_TEXT = /\btext-\[[^\]]*(?:rem|px|em|ch)[^\]]*\]/g;
/** `tracking-[0.18em]` — the eyebrow treatment, respelled slightly differently. */
const ARBITRARY_TRACKING = /\btracking-\[[^\]]*\]/g;
/** Any hardcoded hex, whatever utility carries it. */
const RAW_HEX = /-\[#[0-9a-fA-F]{3,8}(?:\/\d+)?\]/g;
/** Tailwind's shadow scale answers "how big"; elevation roles answer "what is this". */
const RAW_SHADOW = /\bshadow-(?:xs|sm|md|lg|xl|2xl)\b/g;
/** A page container invented per page rather than taken from PageShell. */
const ADHOC_CONTAINER = /\bmx-auto\s+max-w-(?:xs|sm|md|lg|xl|\dxl)\b|\bmax-w-(?:xs|sm|md|lg|xl|\dxl)\s+mx-auto\b/g;

/** Shape is a token axis too: `rounded-card` / `rounded-field`, not Tailwind's radius scale. */
const RAW_RADIUS = /\brounded-(sm|md|lg|xl|2xl|3xl)\b/g;

/**
 * Files still on Tailwind's radius scale.
 *
 * One shared reason rather than 78 individual ones: `--radius-card` and `--radius-field` were
 * added after most of this UI was written, so every entry here predates the tokens. Converting is
 * mechanical and touches 78 files, which is a change of its own rather than a line in someone
 * else's. **New files may not join this list** — that is the whole point of writing it down.
 *
 * `rounded-full` and `rounded-none` are absent deliberately: a pill and a square corner are not
 * points on the radius scale, so no token replaces them.
 */
const SHAPE_LEGACY = new Set([
  "src/app/(admin)/admin/carts/page.tsx",
  "src/app/(admin)/admin/orders/page.tsx",
  "src/app/(admin)/admin/payouts/page.tsx",
  "src/app/(admin)/admin/shipping/providers/page.tsx",
  "src/app/(admin)/admin/users/page.tsx",
  "src/app/(auth)/layout.tsx",
  "src/app/(org)/org/[orgId]/earnings/page.tsx",
  "src/app/(org)/org/[orgId]/reviews/page.tsx",
  "src/app/(org)/org/page.tsx",
  "src/components/bidding/BiddingForm.tsx",
  "src/components/bulk-upload/BulkCategoryWizard.tsx",
  "src/components/bulk-upload/BulkProductWizard.tsx",
  "src/components/cart/CartItem.tsx",
  "src/components/cart/cart-summary.tsx",
  "src/components/cart/console/CartsTable.tsx",
  "src/components/category/category-form.tsx",
  "src/components/category/category-hero.tsx",
  "src/components/checkout/components/CouponField.tsx",
  "src/components/checkout/components/GuestAddress.tsx",
  "src/components/checkout/components/MultiShippingSection.tsx",
  "src/components/checkout/components/checkout-summary.tsx",
  "src/components/checkout/index.tsx",
  "src/components/dashboard/dashboard-live.tsx",
  "src/components/home/hero-banner.tsx",
  "src/components/home/offers-strip.tsx",
  "src/components/layout/PortalHeader.tsx",
  "src/components/layout/navbar/NavbarSearch.tsx",
  "src/components/layout/navbar/ProfileMenu.tsx",
  "src/components/order/order-lookup.tsx",
  "src/components/order/order-summary.tsx",
  "src/components/order/orders-client.tsx",
  "src/components/org/console/index.tsx",
  "src/components/org/org-switcher.tsx",
  "src/components/payouts/CommercialTerms.tsx",
  "src/components/payouts/SettleEntries.tsx",
  "src/components/payouts/SettlementList.tsx",
  "src/components/product/console/productEdit/index.tsx",
  "src/components/product/console/productsList/components/ProductsFilters.tsx",
  "src/components/product/console/productsList/components/ProductsTable.tsx",
  "src/components/product/product-gallery.tsx",
  "src/components/product/reviews.tsx",
  "src/components/profile/address-modal.tsx",
  "src/components/profile/addresses-section.tsx",
  "src/components/profile/change-password-modal.tsx",
  "src/components/profile/profile-pic-upload.tsx",
  "src/components/profile/recent-orders-section.tsx",
  "src/components/promotions/OfferForm.tsx",
  "src/components/promotions/ProductPicker.tsx",
  "src/components/shared/ShareDialog.tsx",
  "src/components/shared/data-table.tsx",
  "src/components/shared/forms/category/CategoryBasicFields.tsx",
  "src/components/shared/forms/category/CategoryImageField.tsx",
  "src/components/shared/forms/category/CategoryStylingFields.tsx",
  "src/components/shared/forms/orgs/index.tsx",
  "src/components/shared/forms/product/ProductBasicFields.tsx",
  "src/components/shared/forms/product/ProductInventoryFields.tsx",
  "src/components/shared/forms/product/ProductOrgShippingFields.tsx",
  "src/components/shared/forms/product/ProductPricingFields.tsx",
  "src/components/shared/forms/product/index.tsx",
  "src/components/shared/image-lightbox.tsx",
  "src/components/shared/image-upload.tsx",
  "src/components/shared/product-card.tsx",
  "src/components/shared/states/LoadingSkeleton.tsx",
  "src/components/shared/stats-card.tsx",
  "src/components/shipping/ShipmentTrackingForm.tsx",
  "src/components/shipping/providers-console/component/ConnectProviderModal.tsx",
  "src/components/ui/skeleton.tsx",
  "src/components/wishlist/wishlist-grid.tsx",
]);

/** A rule, and optionally the files that predate the token it enforces. */
interface TokenRule {
  name: string;
  pattern: RegExp;
  fix: string;
  legacy?: ReadonlySet<string>;
}

const RULES: TokenRule[] = [
  { name: "raw colour palette classes", pattern: RAW_PALETTE, fix: "use a semantic colour token" },
  { name: "arbitrary font sizes", pattern: ARBITRARY_TEXT, fix: "use a step on the type scale (text-4xs … text-3xl)" },
  { name: "arbitrary letter-spacing", pattern: ARBITRARY_TRACKING, fix: "use tracking-label / -eyebrow / -eyebrow-wide / -display" },
  { name: "hardcoded hex colours", pattern: RAW_HEX, fix: "use a token, or add it to the one module that owns that palette" },
  { name: "raw Tailwind shadows", pattern: RAW_SHADOW, fix: "use shadow-raised / -lifted / -overlay / -inset-field" },
  { name: "ad-hoc page containers", pattern: ADHOC_CONTAINER, fix: "use <PageShell width=…>" },
  {
    name: "raw radius scale",
    pattern: RAW_RADIUS,
    fix: "use rounded-card (surfaces) or rounded-field (inputs and controls)",
    legacy: SHAPE_LEGACY,
  },
] as const;

// file -> the rules it is excused from, and why.
const ALLOWLIST: Record<string, { rules: readonly string[]; reason: string }> = {
  "src/lib/category-accent.ts": {
    rules: ["raw colour palette classes"],
    reason:
      "The accent palette is a closed decorative set keyed by CategoryAccent rows; the classes live only here so the database never holds them and Tailwind can scan them statically.",
  },
  "src/lib/social-brand.ts": {
    rules: ["hardcoded hex colours"],
    reason:
      "Third-party brand colours are not ours to theme — Facebook blue is Facebook blue in either mode — so they sit outside the token system, in one module rather than at the call site.",
  },
};

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const FILES = sourceFiles("src");

describe("design decisions go through tokens", () => {
  it.each(RULES)("uses no $name outside the allowlist", ({ name, pattern, fix, legacy }) => {
    const offenders: string[] = [];
    for (const file of FILES) {
      if (ALLOWLIST[file]?.rules.includes(name)) continue;
      // A rule carrying a `legacy` set is a ratchet: what predates the token is listed, and a
      // file not on the list must use it. New code cannot join the backlog.
      if (legacy?.has(file)) continue;
      const matches = readFileSync(file, "utf8").match(pattern);
      if (matches) offenders.push(`${file} — ${[...new Set(matches)].join(", ")} — ${fix}`);
    }
    expect(
      offenders,
      offenders.length ? `\n    ${offenders.join("\n    ")}` : "",
    ).toEqual([]);
  });

  it("the shape backlog only shrinks", () => {
    // An entry that no longer uses the raw scale has been converted; removing it is what makes
    // the list a backlog rather than a permanent exemption.
    // A fresh, non-global copy: `RAW_RADIUS` carries the `g` flag, and `.test()` on a global
    // regex advances `lastIndex` between calls, so reusing it here skips every other file.
    const hasRawRadius = (source: string) => new RegExp(RAW_RADIUS.source).test(source);
    const stale = [...SHAPE_LEGACY].filter(
      (file) => !FILES.includes(file) || !hasRawRadius(readFileSync(file, "utf8")),
    );
    expect(
      stale,
      "Converted to rounded-card / rounded-field — remove from SHAPE_LEGACY:\n    " + stale.join("\n    "),
    ).toEqual([]);
  });

  it("keeps the allowlist honest: entries must still contain what they excuse", () => {
    for (const [file, { rules, reason }] of Object.entries(ALLOWLIST)) {
      expect(reason.length).toBeGreaterThan(30);
      const source = readFileSync(file, "utf8");
      for (const name of rules) {
        const rule = RULES.find((r) => r.name === name);
        expect(rule, `unknown rule "${name}" in allowlist`).toBeDefined();
        expect(source.match(rule!.pattern), `${file} no longer needs its "${name}" exemption`).not.toBeNull();
      }
    }
  });

  it("keeps the tokens this suite relies on defined", () => {
    for (const token of [
      "--color-success", "--color-warning", "--color-info", "--color-scrim", "--color-hero",
      "--text-2xs", "--text-3xs", "--text-4xs",
      "--tracking-label", "--tracking-eyebrow", "--tracking-eyebrow-wide", "--tracking-display",
      "--shadow-raised", "--shadow-lifted", "--shadow-overlay", "--shadow-inset-field",
      "--radius-card", "--radius-field",
      "--container-page",
      "--font-heading",
      // storefront-themes D2, D3
      "--font-display", "--font-label", "--shadow-tile", "--container-store", "--ease-theme",
      "--text-headline", "--text-title", "--text-body", "--text-tag", "--text-price",
      "--tracking-headline", "--tracking-tag", "--spacing-section", "--spacing-gutter", "--spacing-grid",
      "--color-deal", "--color-deal-foreground", "--color-feature", "--color-feature-foreground",
      "--color-photo-scrim", "--color-on-photo",
    ]) {
      expect(CSS, `${token} is used by a utility but not defined`).toContain(token);
    }
  });
});

// `font-heading` sat in 20 files for months generating no CSS at all, because
// --font-heading was set by next/font but never registered as a theme token. A class
// that silently does nothing is worse than a wrong one: it looks applied.
describe("every font utility resolves to a real family", () => {
  const TAILWIND_BUILT_IN = new Set([
    "sans", "serif", "mono",
    "thin", "extralight", "light", "normal", "medium",
    "semibold", "bold", "extrabold", "black",
  ]);

  // `font-size` inside an inline SVG, `--font-heading-face` in next/font's config, and
  // the `font-src` directive in src/lib/security-headers.ts are the same characters as a
  // utility class without being one. (`src` is also a real @font-face descriptor.)
  const CSS_PROPERTY = new Set([
    "src",
    "size", "family", "weight", "style", "variant", "stretch", "feature-settings",
    "variation-settings", "kerning", "optical-sizing", "smoothing",
  ]);

  const declared = new Set(
    [...CSS.matchAll(/^\s*--font-([a-z0-9-]+)\s*:/gm)].map((m) => m[1])
  );

  it("has no font-* class without a matching --font-* theme token", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      for (const [, name] of readFileSync(file, "utf8").matchAll(/(?<![-\w])font-([a-z][a-z0-9-]*)\b/g)) {
        if (TAILWIND_BUILT_IN.has(name) || declared.has(name) || CSS_PROPERTY.has(name)) continue;
        offenders.push(`${file} — font-${name} generates no CSS`);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});

// A semantic token says what a colour is for; a primitive says what the colour is. Keeping
// raw values in one palette block is what lets a theme pick from the palette instead of
// inventing a near-duplicate (ADR-0049) — there were 52 values, several spelled out 5–7 times.
describe("colour values live in the primitive palette", () => {
  const FAMILY =
    "parchment|charcoal|emerald|green|gold|rose|maroon|red|amber|blue|pink|orange|violet|ink|grey|" +
    // storefront palettes (storefront-themes D3)
    "slate|yellow|cobalt|ivory|umber|bottle|navy|magenta|ochre|blush|peach|lilac|leaf";
  const paletteBlock = CSS.split("/* Primitive palette")[1]?.split("}")[0] ?? "";
  const outside = CSS.replace(paletteBlock, "");
  const primitives = [...paletteBlock.matchAll(new RegExp(`(--(?:${FAMILY})-\\d+(?:-soft)?):`, "g"))].map((m) => m[1]);

  it("finds the palette it guards", () => {
    expect(primitives.length).toBeGreaterThan(40);
  });

  it("has no raw colour value outside the palette", () => {
    // Two exemptions, both outside any theme: a shadow is black at low alpha in light and
    // dark alike (Tailwind's own values), and the printed bill is on white paper.
    const themed = outside.replace(/--shadow-[\w-]+:[^;]+;/g, "").split("@media print")[0];
    expect(themed.match(/oklch\(|rgba?\(|hsl\(|#[0-9a-fA-F]{3,8}\b|\bwhite\b|\bblack\b/g) ?? []).toEqual([]);
  });

  it("every primitive is used by a semantic token", () => {
    expect(primitives.filter((p) => !outside.includes(`var(${p})`))).toEqual([]);
  });

  it("no component reads a primitive directly — only the semantic tokens", () => {
    const pattern = new RegExp(`--(?:${FAMILY})-\\d+`);
    expect(FILES.filter((f) => pattern.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
