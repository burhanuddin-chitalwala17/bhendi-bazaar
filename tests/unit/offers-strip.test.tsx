/**
 * The offers strip, and the two different promises its "view" link makes.
 *
 * Worth pinning because the label and the destination have to agree: on the
 * marketplace it leaves for `/offers`, on a shop it stays and narrows the grid. A
 * strip that said "View all" and navigated away, or "View more" and did not, would be
 * lying in a place a shopper acts on.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { OffersStrip } from "@/components/home/offers-strip";
import type { Product } from "@/domain/product";

const product = (n: number): Product =>
  ({
    id: `p${n}`,
    slug: `p${n}`,
    name: `Product ${n}`,
    description: "",
    price: 1000,
    salePrice: 800,
    currency: "INR",
    categorySlug: "c",
    tags: [],
    rating: 0,
    reviewsCount: 0,
    media: [],
    thumbnail: "https://example.test/p.jpg",
    weight: 0,
    stock: 1,
    lowStockThreshold: 0,
    shippingFromPincode: "",
    org: { id: "o", name: "Shop", code: "ORG-1", handle: "shop" },
  }) as Product;

/**
 * `OffersStrip` is an async server component; React Testing Library renders client
 * trees. Awaiting it to an element first is the smallest way to test it without
 * making the component client-side for the test's benefit.
 */
const draw = async (props: React.ComponentProps<typeof OffersStrip>) =>
  render(await OffersStrip(props));

describe("the offers strip", () => {
  it("renders nothing when there is nothing reduced", async () => {
    const { container } = await draw({ offers: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a thumbnail per offer, so it can be scanned rather than read", async () => {
    await draw({ offers: [product(1), product(2)] });
    // Decorative: the product name beside it is the accessible label.
    expect(document.querySelectorAll("img")).toHaveLength(2);
  });

  it("offers no way onward when everything fits", async () => {
    await draw({ offers: [product(1)] });
    expect(screen.queryByText(/view/i)).toBeNull();
  });

  it("sends the marketplace to the offers page", async () => {
    await draw({
      offers: [product(1)],
      viewAll: { href: "/offers", label: "View more" },
    });
    const link = screen.getByRole("link", { name: /view more/i });
    expect(link).toHaveAttribute("href", "/offers");
  });

  it("keeps a shop on its own page, and says so", async () => {
    await draw({
      offers: [product(1)],
      viewAll: { href: "/store/naaz?offers=1", label: "View all" },
    });
    const link = screen.getByRole("link", { name: /view all/i });
    expect(link).toHaveAttribute("href", "/store/naaz?offers=1");
  });
});
