/**
 * A buyer in a shop stays in it (storefront-themes Q33): a variant reached from a shop's product page
 * keeps `?shop=`, so the shop's chrome holds; on the marketplace the link stays the canonical one.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/wishlist/wishlist-button", () => ({ WishlistButton: () => null }));
vi.mock("@/components/shared/ShareButton", () => ({ ShareButton: () => null }));
vi.mock("@/components/product/delivery-check", () => ({ DeliveryCheck: () => null }));
vi.mock("@/components/product/product-buy-actions", () => ({ ProductBuyActions: () => null }));
vi.mock("@/components/support/contact-launcher", () => ({
  ContactLauncher: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { ProductDetails } from "@/components/product/product-details";
import type { Product } from "@/domain/product";

const product = {
  id: "p1",
  slug: "nida-abaya-black",
  name: "Nida Everyday Abaya, Black",
  price: 145000,
  stock: 3,
  lowStockThreshold: 1,
  thumbnail: "/a.webp",
  rating: 0,
  reviewsCount: 0,
  org: { id: "org-1", name: "Niqab Boutique", handle: "niqab-boutique" },
  siblings: [
    { slug: "nida-abaya-black", name: "Black", thumbnail: "/a.webp", price: 145000, isCurrent: true },
    { slug: "nida-abaya-navy", name: "Navy", thumbnail: "/b.webp", price: 145000, isCurrent: false },
  ],
} as unknown as Product;

describe("variant links keep the shop (storefront-themes Q33)", () => {
  it("inside a shop, a variant opens with ?shop= so the shop's chrome holds", () => {
    render(<ProductDetails {...product} shopHandle="niqab-boutique" />);
    expect(screen.getByRole("link", { name: /Navy/ }).getAttribute("href")).toBe("/product/nida-abaya-navy?shop=niqab-boutique");
  });

  it("on the marketplace, a variant opens on its canonical page", () => {
    render(<ProductDetails {...product} />);
    expect(screen.getByRole("link", { name: /Navy/ }).getAttribute("href")).toBe("/product/nida-abaya-navy");
  });
});

describe("similar products below a shop's product keep the shop (storefront-themes Q33)", () => {
  it("each card links with ?shop= inside a shop, canonically elsewhere", async () => {
    const { ProductGrid } = await import("@/components/shared/product-grid");
    const { container, rerender } = render(<ProductGrid products={[product]} shopHandle="niqab-boutique" />);
    const hrefs = () => [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(new Set(hrefs())).toEqual(new Set(["/product/nida-abaya-black?shop=niqab-boutique"]));
    rerender(<ProductGrid products={[product]} />);
    expect(new Set(hrefs())).toEqual(new Set(["/product/nida-abaya-black"]));
  });
});
