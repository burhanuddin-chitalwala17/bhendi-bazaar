/**
 * The seller's bulk actions on the products list (design-system Q29), from the screen's side: what
 * the request carries is what the server trusts least. A rupee amount must cross as integer paise
 * (Invariant 3), a stock edit must carry the count the seller saw so a concurrent sale is refused
 * rather than overwritten (Invariant 6), and a finished action must let go of the selection.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProductsContainer } from "@/components/product/console/productsList";
import { BULK_COPY } from "@/components/product/console/bulk/bulk-copy";
import { priceChangeFrom, rupeesTextToPaise, stockRowsFrom, cellKey } from "@/components/product/console/bulk/bulk-input";
import type { ProductForTable, ProductStats } from "@/components/product/console/types";
import { BULK_ACTION, BULK_PRICE_MODE } from "@server/catalog/product-bulk.types";
import { ProductFlag } from "@/types/shared";

const h = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiRequest: h.apiRequest, TRANSFER_TIMEOUT_MS: 120_000 }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ orgId: "org-1" }),
  usePathname: () => "/org/org-1/products",
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/hooks/core/useMediaQuery", async (actual) => ({
  ...(await actual<typeof import("@/hooks/core/useMediaQuery")>()),
  useIsTabletUp: () => true,
}));

const product = (id: string, quantity: number): ProductForTable => ({
  id,
  name: `Rida ${id}`,
  flags: [] as ProductFlag[],
  sku: `SKU-${id}`,
  price: 245000,
  currency: "INR",
  stock: quantity,
  stockByLocation: [{ orgAddressId: "loc-1", quantity }],
  lowStockThreshold: 2,
  thumbnail: "/cover.jpg",
  wishlistCount: 0,
  archivedAt: null,
  teamEditedAt: null,
  createdAt: new Date("2026-01-01"),
  category: { id: "cat-1", name: "Rida" },
  org: { id: "org-1", name: "Naaz", code: "NAAZ" },
});

const stats: ProductStats = {
  totalProducts: 2, familyCount: 0, archivedProducts: 0, lowStockProducts: 0,
  outOfStockProducts: 0, featuredProducts: 0, totalInventoryValue: 0,
};

const show = () =>
  render(
    <ProductsContainer
      initialData={{ products: [product("p-1", 5), product("p-2", 0)], pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } }}
      initialStats={stats}
      initialFilters={{ orgId: "org-1", page: 1, limit: 10 }}
      categories={[]}
      locations={[{ id: "loc-1", name: "Bhendi Bazaar" }]}
    />,
  );

/** The list renders as rows and as a table (CSS picks one); either checkbox selects. */
const pick = (name: string) => fireEvent.click(screen.getAllByRole("checkbox", { name: `Select ${name}` })[0]);
const sentBody = () => h.apiRequest.mock.calls.at(-1)![1].body;
const ok = (action: string) => ({ action, updated: 1, skipped: [], conflicts: [] });

beforeEach(() => h.apiRequest.mockReset());

describe("what a bulk edit sends", () => {
  it("parses rupees from the digits, so ₹0.29 is 29 paise and never 28.999…", () => {
    expect(0.29 * 100).not.toBe(29);
    expect(rupeesTextToPaise("0.29")).toBe(29);
    expect(rupeesTextToPaise("1,200.29")).toBe(120029);
    expect(rupeesTextToPaise("12.5")).toBe(1250);
    expect(rupeesTextToPaise("12.555")).toBeNull();
    expect(priceChangeFrom({ mode: BULK_PRICE_MODE.AMOUNT, direction: "down", text: "50" })).toEqual({
      ok: true,
      change: { mode: BULK_PRICE_MODE.AMOUNT, deltaPaise: -5000 },
    });
  });

  it("sends only the cells the seller changed, each with the count it was read at (0 where none)", () => {
    const rows = stockRowsFrom(
      [{ id: "p-1", stockByLocation: [{ orgAddressId: "a", quantity: 5 }] }],
      ["a", "b"],
      { [cellKey("p-1", "a")]: "7", [cellKey("p-1", "b")]: "3" },
    );
    expect(rows).toEqual([
      { productId: "p-1", orgAddressId: "a", quantity: 7, seenQuantity: 5 },
      { productId: "p-1", orgAddressId: "b", quantity: 3, seenQuantity: 0 },
    ]);
  });

  it("a price change crosses the wire as integer paise for the selected products", async () => {
    h.apiRequest.mockResolvedValue(ok(BULK_ACTION.PRICE));
    show();
    pick("Rida p-1");
    pick("Rida p-2");
    fireEvent.click(screen.getByRole("button", { name: BULK_COPY.actionLabel[BULK_ACTION.PRICE] }));
    fireEvent.change(screen.getByLabelText(BULK_COPY.rupeesLabel), { target: { value: "1200.29" } });
    fireEvent.click(screen.getByRole("button", { name: BULK_COPY.submit[BULK_ACTION.PRICE] }));

    await waitFor(() => expect(h.apiRequest).toHaveBeenCalledTimes(1));
    expect(h.apiRequest.mock.calls[0][0]).toBe("/api/org/org-1/products/bulk-edit");
    expect(sentBody()).toEqual({ action: BULK_ACTION.PRICE, productIds: ["p-1", "p-2"], change: { mode: BULK_PRICE_MODE.SET, pricePaise: 120029 } });
  });

  it("a stock edit carries the seen quantity, and the selection is let go once the server answers", async () => {
    h.apiRequest.mockResolvedValue(ok(BULK_ACTION.STOCK));
    show();
    pick("Rida p-1");
    expect(screen.getByRole("region", { name: "Selection" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: BULK_COPY.actionLabel[BULK_ACTION.STOCK] }));
    const cell = screen.getByLabelText("Bhendi Bazaar") as HTMLInputElement;
    expect(cell.value).toBe("5");
    fireEvent.change(cell, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: BULK_COPY.submit[BULK_ACTION.STOCK] }));

    await waitFor(() => expect(screen.getByText(BULK_COPY.updated[BULK_ACTION.STOCK](1))).toBeTruthy());
    expect(sentBody()).toEqual({
      action: BULK_ACTION.STOCK,
      rows: [{ productId: "p-1", orgAddressId: "loc-1", quantity: 2, seenQuantity: 5 }],
    });
    expect(screen.queryByRole("region", { name: "Selection" })).toBeNull();
  });

  it("an untouched stock form warns instead of sending, with Save still live (ADR-0053)", () => {
    show();
    pick("Rida p-1");
    fireEvent.click(screen.getByRole("button", { name: BULK_COPY.actionLabel[BULK_ACTION.STOCK] }));
    const save = screen.getByRole("button", { name: BULK_COPY.submit[BULK_ACTION.STOCK] });
    fireEvent.click(save);
    expect(screen.getByRole("alert").textContent).toBe(BULK_COPY.nothingChanged);
    expect(save.hasAttribute("disabled")).toBe(false);
    expect(h.apiRequest).not.toHaveBeenCalled();
  });
});
