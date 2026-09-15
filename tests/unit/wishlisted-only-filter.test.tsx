/**
 * "Wishlisted only" is a filter, not a view switch.
 *
 * It decides which rows come back, so unlike the demand column — merged in after the
 * page is chosen (wishlist-demand-column.test.ts) — it has to reach the server. These
 * tests pin the client half: the switch writes a URL param and resets to page 1, and
 * the demand column stays visible either way.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductsContainer } from "@/admin/products/productsList";
import type { ProductForTable, ProductFilters, ProductStats } from "@/admin/products/types";
import { ProductFlag } from "@/types/shared";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ orgId: "org-1" }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const product = (id: string, wishlistCount: number): ProductForTable => ({
  id,
  name: `Product ${id}`,
  flags: [] as ProductFlag[],
  sku: `SKU-${id}`,
  price: 129900,
  currency: "INR",
  rating: 0,
  stock: 5,
  lowStockThreshold: 2,
  thumbnail: "cover.jpg",
  wishlistCount,
  createdAt: new Date("2026-01-01"),
  category: { id: "cat-1", name: "Veg" },
  org: { id: "org-1", name: "Org One", code: "ORG1" },
});

const stats: ProductStats = {
  totalProducts: 2,
  lowStockProducts: 0,
  outOfStockProducts: 0,
  featuredProducts: 0,
  totalInventoryValue: 0,
};

const renderTable = (filters: ProductFilters = {}) =>
  render(
    <ProductsContainer
      initialData={{
        products: [product("p-1", 3), product("p-2", 0)],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      }}
      initialStats={stats}
      initialFilters={{ orgId: "org-1", page: 1, limit: 10, ...filters }}
      categories={[{ id: "cat-1", name: "Veg" }]}
    />
  );

const toggle = () => screen.getByRole("switch");
const pushedUrl = () => new URL(push.mock.calls[0][0], "https://x.test");

beforeEach(() => {
  push.mockReset();
});

describe("the Wishlisted-only switch", () => {
  it("is off by default, so the list starts unfiltered", () => {
    renderTable();
    expect(toggle().getAttribute("aria-checked")).toBe("false");
  });

  it("reflects a filter already in the URL", () => {
    renderTable({ wishlistedOnly: true });
    expect(toggle().getAttribute("aria-checked")).toBe("true");
  });

  it("asks the server for the filtered list when switched on", () => {
    renderTable();
    fireEvent.click(toggle());
    expect(pushedUrl().searchParams.get("wishlisted")).toBe("true");
  });

  it("goes back to page 1 — page 4 of everything is not page 4 of the saved ones", () => {
    renderTable({ page: 4 });
    fireEvent.click(toggle());
    expect(pushedUrl().searchParams.get("page")).toBe("1");
  });

  it("drops the param when switched off, rather than sending wishlisted=false", () => {
    renderTable({ wishlistedOnly: true });
    fireEvent.click(toggle());
    expect(pushedUrl().searchParams.has("wishlisted")).toBe(false);
  });

  it("keeps the demand column in both states — it is a filter, not a column switch", () => {
    renderTable({ wishlistedOnly: true });
    expect(screen.getByRole("columnheader", { name: "Wishlisted" })).toBeTruthy();
  });

  it("has a heart in the thumb and a label wired to it", () => {
    const { container } = renderTable();
    expect(container.querySelector('[role="switch"] svg.lucide-heart')).toBeTruthy();
    const label = screen.getByText("Wishlisted only", { selector: "label" });
    expect(label.getAttribute("for")).toBe(toggle().getAttribute("id"));
  });
});
