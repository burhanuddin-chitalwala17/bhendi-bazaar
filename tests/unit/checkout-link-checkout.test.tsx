/**
 * checkout-links unit 2, the buyer's checkout: a link's lines grouped under the chat they came from,
 * what was already in the bag below them and removable, the notes on what changed (D4), and the
 * link riding on each order line for attribution (D5).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { CartItem } from "@/domain/cart";
import type { CheckoutLinkNote } from "@server/cart/checkout-link.types";

const createOrderWithShipments = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));
vi.mock("@/components/product/stockApiClient", () => ({
  stockApiClient: { check: vi.fn().mockResolvedValue({ available: true, items: [] }) },
}));
vi.mock("@/components/order/orderApiClient", () => ({ orderApiClient: { createOrderWithShipments } }));

import { CheckoutLinkGroups } from "@/components/checkout/components/CheckoutLinkGroups";
import { useCheckoutSnapshot } from "@/components/checkout/hooks/useCheckoutSnapshot";
import { useCheckoutPayment } from "@/components/checkout/hooks/useCheckoutPayment";
import { useCartStore } from "@/store/cartStore";

const line = (productId: string, price: number, fromLinkId?: string): CartItem => ({
  id: `line-${productId}`,
  productId,
  productSlug: productId,
  productName: productId === "kurta" ? "Kurta, L" : productId === "scarf" ? "Scarf" : productId,
  thumbnail: "/x.webp",
  price,
  quantity: 1,
  weight: 0.5,
  shippingFromPincode: "400001",
  org: { id: "org", name: "Niqab Boutique", code: "N-1", handle: "niqab" },
  ...(fromLinkId ? { fromLinkId } : {}),
});

const kurta = line("kurta", 119_900, "link-1");
const scarf = line("scarf", 29_900);
const note: CheckoutLinkNote = {
  linkId: "link-1",
  shopName: "Niqab Boutique",
  shopHandle: "niqab",
  leftOut: [{ productId: "dupatta", productName: "Dupatta, green" }],
  priceChanges: [{ productId: "kurta", nowPaise: 119_900, wasPaise: 129_900 }],
};

describe("checkout holding a link's items", () => {
  it("shows the link's items under the chat, tagged, and the bag's items below them, removable (spec A3)", () => {
    const onRemove = vi.fn();
    render(<CheckoutLinkGroups items={[scarf, kurta]} notes={[]} onRemove={onRemove} />);

    const fromChat = screen.getByRole("region", { name: "From your chat with Niqab Boutique" });
    expect(fromChat.textContent).toContain("Kurta, L");
    expect(fromChat.textContent).toContain("From your chat");
    expect(fromChat.textContent).not.toContain("Scarf");

    const already = screen.getByRole("region", { name: "Already in your cart" });
    expect(already.textContent).toContain("Scarf");
    fireEvent.click(screen.getByRole("button", { name: "Remove Scarf" }));
    expect(onRemove).toHaveBeenCalledWith(scarf);
    expect(screen.queryByRole("button", { name: /Remove Kurta/ })).toBeNull();
  });

  it("names what was left out and shows a price that moved, plainly (spec A2, R4)", () => {
    render(<CheckoutLinkGroups items={[kurta]} notes={[note]} onRemove={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Dupatta, green is out of stock and was left out.");
    expect(screen.getByText("Now ₹1,199 (was ₹1,299 when sent)")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Already in your cart" })).toBeNull();
  });

  it("renders nothing for a checkout no link added to", () => {
    const { container } = render(<CheckoutLinkGroups items={[scarf]} notes={[]} onRemove={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("removing a line at checkout", () => {
  beforeEach(() => {
    useCartStore.getState().setItems([scarf, kurta]);
    useCartStore.setState({ hasHydrated: true });
  });

  it("takes it out of this checkout and the bag together (spec A3)", () => {
    const { result } = renderHook(() => useCheckoutSnapshot());
    expect(result.current.items.map((i) => i.productId)).toEqual(["scarf", "kurta"]);
    act(() => result.current.remove(scarf));
    expect(result.current.items.map((i) => i.productId)).toEqual(["kurta"]);
    expect(useCartStore.getState().items.map((i) => i.productId)).toEqual(["kurta"]);
  });
});

describe("placing the order", () => {
  it("sends each line's link with it, and no price (D5)", async () => {
    createOrderWithShipments.mockRejectedValue(new Error("stop here"));
    const { result } = renderHook(() => useCheckoutPayment());
    await act(async () => {
      await result.current
        .processPaymentWithShipments({
          shippingGroups: [
            {
              groupId: "g", orgId: "org", orgName: "Niqab", fromPincode: "400001", fromCity: "Mumbai", fromState: "MH",
              items: [kurta, scarf], selectedRate: { quote: "q" },
            },
          ],
          totals: { itemsTotal: 0, shippingTotal: 0, discount: 0, grandTotal: 149_800 },
          address: {},
          paymentMethod: "razorpay",
          paymentStatus: "pending",
          isBuyNow: false,
        } as never)
        .catch(() => {});
    });
    const sent = createOrderWithShipments.mock.calls[0][0].shippingGroups[0].items;
    expect(sent).toEqual([
      { productId: "kurta", quantity: 1, size: undefined, color: undefined, fromLinkId: "link-1" },
      { productId: "scarf", quantity: 1, size: undefined, color: undefined, fromLinkId: undefined },
    ]);
  });
});
