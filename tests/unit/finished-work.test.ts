import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ships, statusOf } from "../../scripts/main-ready.mjs";

// True on every branch, unlike `npm run check:main-ready`: a shipped feature keeps what must stay true and why,
// and nothing else (ADR-0073, ADR-0084). Unshipped folders are a feature branch's business.
const ROOT = resolve(__dirname, "../..");
const SPECS = join(ROOT, "docs/specs");

/** Shipped before ADR-0061 gave features a decisions.md; a ratchet (ADR-0056): entries only leave. */
const PREDATES_DECISION_LOGS = new Map<string, string>(
  [
    "bidding", "channel-registry", "checkout-abandonment", "contact-us", "copy-product",
    "home-banners", "image-delivery", "image-enhancement", "international-phone", "inventory-reservation",
    "listing-vocabulary", "listing-vocabulary/categories", "listing-vocabulary/inherited-facts",
    "listing-vocabulary/product-types", "listing-vocabulary/variants", "media-library", "media-library/renditions",
    "media-library/video-hosting", "money-as-paise", "multi-vendor-marketplace/addresses-as-entities",
    "multi-vendor-marketplace/category-tree", "multi-vendor-marketplace/dashboard-widgets",
    "multi-vendor-marketplace/order-and-cart-lines", "multi-vendor-marketplace/org-onboarding",
    "multi-vendor-marketplace/org-portal-chrome", "multi-vendor-marketplace/organisations-and-membership",
    "multi-vendor-marketplace/portal-separation", "multi-vendor-marketplace/stock-locations-and-allocation",
    "org-storefront", "org-storefront/org-handle", "org-storefront/org-withdrawal", "org-storefront/seller-identity",
    "org-storefront/storefront-branding", "org-storefront/storefront-browse", "org-storefront/storefront-discovery",
    "org-storefront/storefront-pages", "payment-confirmation", "product-archive", "product-reviews",
    "product-reviews/review-media", "product-video", "product-weight-and-rates", "seller-profile",
    "seller-profile/brand-page", "server-side-pricing-authority", "shared-phone-numbers", "shipment-lifecycle",
    "shopfront-feeds", "worker-foundation",
  ].map((f) => [f, "shipped before ADR-0061 gave every feature a decisions.md"]),
);

function shippedFolders(): { name: string; files: string[] }[] {
  const out: { name: string; files: string[] }[] = [];
  const visit = (dir: string, depth: number) => {
    const entries = readdirSync(dir);
    const spec = join(dir, "spec.md");
    if (depth > 0 && existsSync(spec) && ships(statusOf(readFileSync(spec, "utf8")))) {
      // A subfolder without its own spec.md is planning too; a child spec is judged on its own.
      out.push({ name: relative(SPECS, dir), files: entries.filter((e) => !existsSync(join(dir, e, "spec.md"))) });
    }
    for (const e of entries) if (statSync(join(dir, e)).isDirectory()) visit(join(dir, e), depth + 1);
  };
  visit(SPECS, 0);
  return out;
}

describe("a shipped feature keeps spec.md and decisions.md only", () => {
  const shipped = shippedFolders();

  it("finds the shipped features it judges", () => {
    expect(shipped.length).toBeGreaterThan(20);
  });

  it("holds no trd, ux, prototype or other planning file", () => {
    const extra = shipped.flatMap(({ name, files }) =>
      files.filter((f) => f !== "spec.md" && f !== "decisions.md").map((f) => `docs/specs/${name}/${f}`),
    );
    expect(
      extra,
      "A shipped feature's plan drifts from its code on the next change. Retire it with " +
        "`npm run spec:status -- <feature> Implemented`, which first checks its Q ids are in decisions.md:\n" +
        extra.map((e) => `    ${e}`).join("\n"),
    ).toEqual([]);
  });

  it("keeps its decisions.md, the only record of why", () => {
    const missing = shipped
      .filter(({ name, files }) => !files.includes("decisions.md") && !PREDATES_DECISION_LOGS.has(name))
      .map(({ name }) => `docs/specs/${name}/`);
    expect(missing, `These shipped features have no decisions.md:\n${missing.map((m) => `    ${m}`).join("\n")}`).toEqual([]);
  });

  it("the allowlist only shrinks: every entry is still a shipped folder without decisions.md", () => {
    const byName = new Map(shipped.map((s) => [s.name, s.files]));
    const stale = [...PREDATES_DECISION_LOGS.keys()].filter((name) => byName.get(name)?.includes("decisions.md") !== false);
    expect(stale, `Remove these from PREDATES_DECISION_LOGS:\n${stale.map((s) => `    ${s}`).join("\n")}`).toEqual([]);
  });
});

// A parent can carry a TRD while a new child is planned on its branch; once every child has shipped, nothing can.
describe("a programme parent whose children have all shipped keeps spec.md and decisions.md only", () => {
  it("holds no trd, spike or other planning file", () => {
    const extra: string[] = [];
    const visit = (dir: string, depth: number) => {
      const entries = readdirSync(dir);
      const spec = join(dir, "spec.md");
      const children = entries.filter((e) => existsSync(join(dir, e, "spec.md")));
      const childShips = (c: string) => ships(statusOf(readFileSync(join(dir, c, "spec.md"), "utf8")));
      if (depth > 0 && existsSync(spec) && !ships(statusOf(readFileSync(spec, "utf8"))) && children.length && children.every(childShips)) {
        for (const e of entries) {
          if (e !== "spec.md" && e !== "decisions.md" && !children.includes(e)) extra.push(`docs/specs/${relative(SPECS, dir)}/${e}`);
        }
      }
      for (const e of entries) if (statSync(join(dir, e)).isDirectory()) visit(join(dir, e), depth + 1);
    };
    visit(SPECS, 0);
    expect(extra, `Move what a child cites into the parent's decisions.md, then delete:\n${extra.map((e) => `    ${e}`).join("\n")}`).toEqual([]);
  });
});
