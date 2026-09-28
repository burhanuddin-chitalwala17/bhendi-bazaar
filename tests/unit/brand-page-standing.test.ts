/**
 * What a shop is told its own page shows (brand-page D11).
 *
 * The rule that earns this panel is R2: a section with nothing in it is absent, never a
 * placeholder. That is right for a buyer and blinding for the shop, which cannot tell a
 * section it has not filled from one that is broken. So the panel must never be a second
 * opinion — it runs the same extractors the page runs, and these hold it to that.
 */
import { describe, expect, it } from "vitest";
import type { BrandPage } from "@/data-access-layer/storefront.dal";
import type { Category } from "@/domain/category";
import type { Product } from "@/domain/product";
import {
  brandPageSections,
  BRAND_PAGE_SECTION_ORDER,
} from "@/components/storefront/brand-page/sections";
import {
  brandPageShowing,
  brandPageStanding,
} from "@/components/storefront/brand-page/standing";

const ORG = "org_1";

const category = { id: "c1", name: "Sarees", slug: "sarees" } as unknown as Category;
const product = { id: "p1", name: "Saree", slug: "saree" } as unknown as Product;

const full = (overrides: Partial<BrandPage> = {}): BrandPage =>
  ({
    id: ORG,
    handle: "silks",
    name: "Silks & Co",
    tagline: "Silks since 1985",
    heroUrl: null,
    logoUrl: null,
    accent: null,
    location: "Mumbai",
    since: 2021,
    about: "Who we are.",
    story: "The longer story.",
    deliveryPolicy: "3 to 5 days",
    returnsPolicy: "7 days",
    brands: ["Silks & Co", "Zari House"],
    social: [
      { network: "instagram", label: "Instagram", handle: "silks", href: "https://x/" },
    ],
    proof: null,
    buyersSay: null,
    owner: { name: "Anisa", role: null, quote: null, photoUrl: null },
    pillars: [{ title: "Woven near by", text: "Three looms we visit." }],
    hiddenSections: [],
    categories: [category],
    newest: [product],
    ...overrides,
  }) as BrandPage;

const standingOf = (page: BrandPage, section: string) =>
  brandPageStanding(page, ORG).find((status) => status.section === section);

describe("what your page shows", () => {
  it("reports every section the platform orders, in that order", () => {
    expect(brandPageStanding(full(), ORG).map((status) => status.section)).toEqual([
      ...BRAND_PAGE_SECTION_ORDER,
    ]);
  });

  it("agrees with the page itself about what is showing, section for section", () => {
    // The property that matters: no section can be promised here and absent there.
    for (const page of [full(), full({ about: null, story: null, owner: null }), full({ pillars: null, social: null })]) {
      const showing = brandPageStanding(page, ORG)
        .filter((status) => status.standing === "showing")
        .map((status) => status.section);
      expect(showing).toEqual(brandPageSections(page));
    }
  });

  it("names the one fact a waiting section needs, and where to supply it", () => {
    const waiting = standingOf(full({ pillars: null }), "pillars");
    expect(waiting?.standing).toBe("waiting");
    expect(waiting?.waitingFor).toMatch(/heading/);
    expect(waiting?.href).toBe(`/org/${ORG}/storefront#pillars`);
  });

  it("sends nobody to a form for a fact no form collects", () => {
    // Reviews arrive from buyers. Offering a link would promise an action that does not exist.
    const waiting = standingOf(full({ buyersSay: null }), "buyersSay");
    expect(waiting?.standing).toBe("waiting");
    expect(waiting?.waitingFor).toBeTruthy();
    expect(waiting?.href).toBeUndefined();
  });

  it("says hidden, not waiting, for a section the shop switched off", () => {
    // Telling a shop to write the thing it just chose to withhold is advice to undo itself.
    const page = full({ pillars: null, hiddenSections: ["pillars"] });
    expect(standingOf(page, "pillars")?.standing).toBe("hidden");
    expect(standingOf(page, "pillars")?.waitingFor).toBeUndefined();
  });

  it("counts only what is showing, so the number matches the page", () => {
    const statuses = brandPageStanding(full({ buyersSay: null }), ORG);
    const { showing, total } = brandPageShowing(statuses);
    expect(total).toBe(BRAND_PAGE_SECTION_ORDER.length);
    expect(showing).toBe(brandPageSections(full({ buyersSay: null })).length);
  });

  it("gives a shop with only a name the two sections it has and a reason for each of the rest", () => {
    const bare = full({
      tagline: null,
      location: null,
      about: null,
      story: null,
      owner: null,
      pillars: null,
      brands: null,
      social: null,
      buyersSay: null,
      deliveryPolicy: null,
      returnsPolicy: null,
      categories: [],
      newest: [],
    });
    const statuses = brandPageStanding(bare, ORG);
    expect(statuses.filter((s) => s.standing === "showing").map((s) => s.section)).toEqual([
      "hero",
      "newest",
    ]);
    for (const status of statuses.filter((s) => s.standing === "waiting")) {
      expect(status.waitingFor, `${status.section} must say what it needs`).toBeTruthy();
    }
  });
});
