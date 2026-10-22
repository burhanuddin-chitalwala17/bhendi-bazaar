/**
 * The Settle page's form sends what the owner chose (product-merge D10). The first build validated
 * the form before its choices were in it, so "Add product" could never submit; this is that test.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SettleForm } from "@/components/channel/settle-form";
import type { SettleDetailDTO, SettleSideDTO } from "@server/channels/channel-connection.types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));
const settle = vi.fn();
vi.mock("@/components/channel/channelsApiClient", () => ({
  channelsApiClient: { settle: (...args: unknown[]) => settle(...args), settlePickerProducts: vi.fn() },
}));

const side = (over: Partial<SettleSideDTO>): SettleSideDTO => ({
  listingId: "l-az",
  channel: "amazon",
  label: "Amazon",
  sku: "ABY-BLK-L",
  externalId: "B0C7X3",
  status: "LIVE",
  live: true,
  pricePaise: 189_900,
  quantity: 5,
  title: "Black Nida Abaya with Pockets – Size L",
  description: "Premium Nida fabric.",
  photoUrls: ["https://m.media-amazon.com/main.jpg"],
  readFailed: false,
  ...over,
});

const detail = (over: Partial<SettleDetailDTO> = {}): SettleDetailDTO => ({
  mode: "new",
  primary: side({}),
  pair: {
    reason: "same_sku",
    side: side({ listingId: "l-fk", channel: "flipkart", label: "Flipkart", title: "Black Nida Abaya L", description: null, photoUrls: [], pricePaise: 184_900, quantity: 3 }),
  },
  product: null,
  locations: [{ id: "loc-1", name: "Mumbai shop" }],
  defaultCategoryId: "cat-abayas",
  readFinishedAt: null,
  ...over,
});

/** The named button is the form's submit button; submit the form (happy-dom does not submit on a click). */
const press = (name: string) => {
  const button = screen.getByRole("button", { name });
  expect(button).toHaveAttribute("type", "submit");
  fireEvent.submit(button.closest("form")!);
};

const renderForm = (d: SettleDetailDTO) =>
  render(<SettleForm orgId="org_1" orgCode="NQB" detail={d} categories={[{ id: "cat-abayas", name: "Abayas" }]} backHref="/org/org_1/channels/amazon/listings?tab=notLinked" />);

describe("the Settle page's form (product-merge D10)", () => {
  it("adds a new product with the fuller title and photos, both listings, the lowest price and count (spec A1, A3)", async () => {
    settle.mockResolvedValue({ result: { productId: "p1", productName: "Black Nida Abaya with Pockets – Size L", archived: false, mode: "new" } });
    renderForm(detail());
    press("Add product");
    await waitFor(() => expect(settle).toHaveBeenCalledTimes(1));
    expect(settle.mock.calls[0][1]).toMatchObject({
      listingIds: ["l-az", "l-fk"],
      name: "Black Nida Abaya with Pockets – Size L",
      description: "Premium Nida fabric.",
      photosFrom: "l-az",
      sku: "ABY-BLK-L",
      price: 1849,
      categoryId: "cat-abayas",
      stock: [{ locationId: "loc-1", quantity: 3 }],
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/org/org_1/channels/amazon/listings?tab=linked"));
  });

  it("matches with nothing switched: only the listing and the counts seen are sent (spec A2)", async () => {
    settle.mockReset().mockResolvedValue({ result: { productId: "p9", productName: "Brass Bakhoor Burner", archived: false, mode: "match" } });
    renderForm(
      detail({
        mode: "match",
        pair: null,
        product: { id: "p9", name: "Brass Bakhoor Burner", sku: "BAKH-01", description: "Ours", pricePaise: 119_900, photoUrls: [], archived: false, stock: [{ locationId: "loc-1", quantity: 6 }] },
      }),
    );
    press("Link and save");
    await waitFor(() => expect(settle).toHaveBeenCalledTimes(1));
    const body = settle.mock.calls[0][1];
    expect(body).toMatchObject({ listingIds: ["l-az"], productId: "p9", stock: [{ locationId: "loc-1", quantity: 6, seenQuantity: 6 }] });
    expect(body.name).toBeUndefined();
    expect(body.photosFrom).toBeUndefined();
  });

  it("asks for a photo when no side has one, and sends nothing until it has (Q20)", async () => {
    settle.mockReset();
    renderForm(detail({ primary: side({ channel: "flipkart", label: "Flipkart", photoUrls: [], description: null }), pair: null }));
    expect(screen.getByText("Add at least one photo. Flipkart doesn't share its photos with us.")).toBeInTheDocument();
    press("Add product");
    await waitFor(() => expect(screen.getByText("Please fix the highlighted fields and try again.")).toBeInTheDocument());
    expect(settle).not.toHaveBeenCalled();
  });
});
