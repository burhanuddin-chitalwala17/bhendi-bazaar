/** Structured data says what the store charges, never more (docs/GTM-READINESS.md B10). */
import { describe, expect, it } from "vitest";
import { paiseToDecimal } from "@/lib/format";
import { breadcrumbJsonLd, productJsonLd, serializeJsonLd, websiteJsonLd } from "@/lib/structured-data";
import nextConfig from "../../next.config";

const product = (over: Record<string, unknown> = {}) =>
  ({
    id: "p1",
    slug: "light-blue-rida",
    name: "Light Blue Rida",
    description: "Soft cotton.",
    price: 129_900,
    currency: "INR",
    stock: 4,
    thumbnail: "/brand/x.png",
    media: [{ kind: "IMAGE", ref: "https://img.example/a.jpg" }],
    org: { name: "Fixture Shop" },
    ...over,
  }) as never;

describe("paiseToDecimal", () => {
  it("writes paise as a decimal from the digits", () => {
    expect(paiseToDecimal(49_900)).toBe("499.00");
    expect(paiseToDecimal(5)).toBe("0.05");
    expect(paiseToDecimal(0)).toBe("0.00");
    expect(paiseToDecimal(120_050)).toBe("1200.50");
    expect(paiseToDecimal(-250)).toBe("-2.50");
  });

  it("refuses a fraction of a paisa (Invariant 3)", () => {
    expect(() => paiseToDecimal(10.5)).toThrow(/integer/);
  });
});

describe("productJsonLd", () => {
  const origin = "https://www.bhendi-bazaar.com";

  it("offers the price the buyer pays: the offer price when one applies", () => {
    expect(productJsonLd(origin, product())!.offers).toMatchObject({ price: "1299.00", priceCurrency: "INR" });
    expect(productJsonLd(origin, product({ salePrice: 99_900 }))!.offers).toMatchObject({ price: "999.00" });
  });

  it("never offers a price the page would not show: a zero or inverted offer reads as the list price", () => {
    expect(productJsonLd(origin, product({ salePrice: 0 }))!.offers).toMatchObject({ price: "1299.00" });
    expect(productJsonLd(origin, product({ salePrice: 150_000 }))!.offers).toMatchObject({ price: "1299.00" });
  });

  it("is left out when the only picture is our logo", () => {
    expect(productJsonLd(origin, product({ media: [], thumbnail: "/brand/bhendi-bazaar.png" }))).toBeNull();
  });

  it("is out of stock when there is none, or when the item is up for bidding", () => {
    expect(productJsonLd(origin, product())!.offers).toMatchObject({ availability: "https://schema.org/InStock" });
    expect(productJsonLd(origin, product({ stock: 0 }))!.offers).toMatchObject({ availability: "https://schema.org/OutOfStock" });
    expect(productJsonLd(origin, product({ biddingSlug: "b" }))!.offers).toMatchObject({ availability: "https://schema.org/OutOfStock" });
  });

  it("names the seller and links absolute images", () => {
    const ld = productJsonLd(origin, product())!;
    expect(ld.url).toBe(`${origin}/product/light-blue-rida`);
    expect(ld.image).toEqual(["https://img.example/a.jpg", "https://x/brand/x.png".replace("https://x", origin)]);
    expect(ld.offers).toMatchObject({ seller: { name: "Fixture Shop" } });
  });
});

describe("serializeJsonLd", () => {
  it("cannot be closed by what it carries", () => {
    const out = serializeJsonLd(productJsonLd("https://x", product({ name: "</script><script>alert(1)</script>" }))!);
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("site markup", () => {
  it("search goes to /s?q=", () => {
    expect(JSON.stringify(websiteJsonLd("https://x"))).toContain("https://x/s?q={search_term_string}");
  });

  it("breadcrumbs are numbered from 1 with absolute links", () => {
    const ld = breadcrumbJsonLd("https://x", [{ name: "Home", path: "/" }, { name: "Abayas", path: "/category/abayas" }]);
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://x/" },
      { "@type": "ListItem", position: 2, name: "Abayas", item: "https://x/category/abayas" },
    ]);
  });
});

describe("htmlLimitedBots", () => {
  const bots = nextConfig.htmlLimitedBots as RegExp;
  it("adds Googlebot and keeps Next's own list", () => {
    expect(bots.test("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(bots.test("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe(true);
    expect(bots.test("Mediapartners-Google")).toBe(true);
    expect(bots.test("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1")).toBe(false);
  });
});
