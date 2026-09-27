/**
 * The brand page with only a name has no placeholder sentence anywhere (brand-page A1), and
 * what an org types reaches the page as text, never as markup (A5, R9). The unit suite in
 * brand-page-sections.test.ts pins which sections appear; this renders them and reads what
 * a buyer would.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandPageSections } from "@/components/storefront/brand-page/brand-page-sections";
import type { BrandPage } from "@/data-access-layer/storefront.dal";
import type { Category } from "@/domain/category";
import type { Product } from "@/domain/product";

// The tile's heart needs the wishlist context the store layout provides; this is about the
// page's sections, not the heart.
vi.mock("@/components/wishlist/wishlist-button", () => ({
  WishlistButton: () => null,
}));

const category = {
  id: "c1",
  slug: "silks",
  parentId: null,
  name: "Silks",
  description: "",
  heroImage: "/silks.webp",
  accent: "EMERALD",
  order: 1,
} as Category;

const product = {
  id: "p1",
  slug: "banarasi-saree",
  name: "Banarasi saree",
  price: 499900,
  stock: 3,
  lowStockThreshold: 2,
  thumbnail: "/saree.webp",
  categorySlug: "silks",
  rating: 0,
  reviewsCount: 0,
} as Product;

const bare = (overrides: Partial<BrandPage> = {}): BrandPage => ({
  id: "org_1",
  handle: "silks",
  name: "Silks & Co",
  tagline: null,
  heroUrl: null,
  logoUrl: null,
  accent: null,
  location: null,
  since: 2021,
  about: null,
  story: null,
  deliveryPolicy: null,
  returnsPolicy: null,
  brands: null,
  social: null,
  proof: null,
  categories: [],
  newest: [],
  ...overrides,
});

describe("the brand page, rendered", () => {
  it("shows a shop with only a name as a shop: a hero, the honest goods state, a way to shop, no placeholder", () => {
    const { container } = render(<BrandPageSections page={bare()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Silks & Co");
    expect(screen.getByText("Nothing here just yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop Silks & Co" })).toHaveAttribute("href", "/store/silks");

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/has not written/i);
    expect(text).not.toMatch(/not yet written|coming soon|placeholder/i);
    expect(screen.queryByText(/This shop's terms/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Follow/)).not.toBeInTheDocument();
  });

  it("renders every section a full profile earns, in the platform's order", () => {
    render(
      <BrandPageSections
        page={bare({
          tagline: "Silks since 1985",
          heroUrl: "/hero.webp",
          logoUrl: "/logo.webp",
          location: "Bhendi Bazaar, Mumbai",
          about: "Three generations of weavers.",
          story: "It began with one loom.",
          deliveryPolicy: "3 to 5 days",
          returnsPolicy: "7 days",
          brands: ["Silks & Co", "Zari House"],
          social: [
            { network: "instagram", label: "Instagram", handle: "silks", href: "https://www.instagram.com/silks/" },
          ],
          categories: [category],
          newest: [product],
        })}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "About Silks & Co",
      "What they sell",
      "Brands they carry",
      "Newest from Silks & Co",
      "Follow Silks & Co",
    ]);
    expect(screen.getByText("Bhendi Bazaar, Mumbai · Since 2021")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Silks" })).toHaveAttribute("href", "/store/silks?category=silks");
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/store/silks");
    expect(screen.getByText("Banarasi saree")).toBeInTheDocument();
    expect(screen.getByText("This shop's terms")).toBeInTheDocument();

    const follow = screen.getByRole("link", { name: "Silks & Co on Instagram" });
    expect(follow).toHaveAttribute("href", "https://www.instagram.com/silks/");
    expect(follow.getAttribute("rel")).toContain("noopener");
  });

  it("shows what an org typed as text, and executes nothing (A5)", () => {
    const { container } = render(
      <BrandPageSections
        page={bare({
          about: "<script>alert(1)</script><img src=x onerror=alert(1)>",
          deliveryPolicy: "<b>fast</b>",
        })}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script><img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(screen.getByText("<b>fast</b>")).toBeInTheDocument();
  });
});
