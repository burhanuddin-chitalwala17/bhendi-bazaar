/**
 * Signing in at checkout (seamless-sign-in D10, D11): the guest's address is cleared
 * for the account's saved ones, offers are re-quoted for the buyer, and the items being
 * checked out stay as they were snapshotted — the sign-in merge changes the cart, not
 * this checkout (R14, R15).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CartItem } from "@/domain/cart";

const { auth, openAuthSheet, getAddresses } = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; name: string } },
  openAuthSheet: vi.fn(),
  getAddresses: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ status: auth.user ? "authenticated" : "guest", user: auth.user }),
}));
vi.mock("@/context/AuthSheetContext", () => ({ useAuthSheet: () => ({ open: openAuthSheet }) }));
vi.mock("@/components/profile/addressApiClient", () => ({ addressApiClient: { getAddresses } }));
vi.mock("@/hooks/shipping/useMultiShippingRates", () => ({
  useMultiShippingRates: () => ({
    groups: [],
    totalShippingCost: 0,
    isLoading: false,
    allocationError: null,
    fetchAllRates: vi.fn(),
    selectRateForGroup: vi.fn(),
  }),
}));
vi.mock("@/components/checkout/hooks/useCheckoutPayment", () => ({
  useCheckoutPayment: () => ({
    processPaymentWithShipments: vi.fn(),
    isProcessing: false,
    error: null,
    setError: vi.fn(),
  }),
}));
vi.mock("@/components/checkout/components/GuestAddress", () => ({
  GuestAddress: ({ onAddressChange }: { onAddressChange: (a: { id: string; fullName: string; pincode: string }) => void }) => (
    <button type="button" onClick={() => onAddressChange({ id: "", fullName: "Guest Address", pincode: "400003" })}>
      fill guest address
    </button>
  ),
}));
vi.mock("@/components/checkout/components/AuthenticatedAddress", () => ({
  AuthenticatedAddress: ({ selectedAddress }: { selectedAddress: { fullName: string } | null }) => (
    <p>selected: {selectedAddress?.fullName ?? "none"}</p>
  ),
}));
vi.mock("@/components/checkout/components/MultiShippingSection", () => ({ MultiShippingSection: () => null }));
vi.mock("@/components/checkout/components/CheckoutActions", () => ({ CheckoutActions: () => null }));
vi.mock("@/components/checkout/components/CouponField", () => ({ CouponField: () => null }));
vi.mock("@/components/checkout/components/checkout-summary", () => ({
  CheckoutSummary: ({ items }: { items: CartItem[] }) => (
    <ul aria-label="checkout items">
      {items.map((item) => (
        <li key={item.id}>{item.productId}</li>
      ))}
    </ul>
  ),
}));

import { CheckoutContainer } from "@/components/checkout";
import { useCartStore } from "@/store/cartStore";

const item = (productId: string): CartItem =>
  ({ id: `line-${productId}`, productId, quantity: 1, price: 1000, productName: productId } as CartItem);

const fetchMock = vi.fn();
const quoteCalls = () =>
  fetchMock.mock.calls.filter(([url]) => url === "/api/checkout/promotions/quote").length;

beforeEach(() => {
  auth.user = null;
  getAddresses.mockResolvedValue([]);
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ lineDiscounts: {}, applied: [], couponCoveredKeys: [], totalDiscountPaise: 0, rejection: null }),
  });
  vi.stubGlobal("fetch", fetchMock);
  useCartStore.getState().setItems([item("A"), item("B")]);
});

describe("signing in at checkout", () => {
  it("offers a guest the sign-in sheet beside the delivery details (R13)", () => {
    render(<CheckoutContainer />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(openAuthSheet).toHaveBeenCalledTimes(1);
  });

  it("clears the guest's address, re-quotes offers, and keeps the snapshotted items (A10)", async () => {
    const view = render(<CheckoutContainer />);
    fireEvent.click(screen.getByRole("button", { name: "fill guest address" }));
    await waitFor(() => expect(quoteCalls()).toBe(1));

    // The sign-in merge brings the account's earlier cart into the store…
    act(() => useCartStore.getState().setItems([item("A"), item("B"), item("C")]));
    auth.user = { id: "user-1", name: "Buyer" };
    view.rerender(<CheckoutContainer />);

    // …the guest address is gone, so the account's saved ones must be chosen from…
    expect(await screen.findByText("selected: none")).toBeInTheDocument();
    await waitFor(() => expect(getAddresses).toHaveBeenCalled());
    // …offers are priced again for the account…
    await waitFor(() => expect(quoteCalls()).toBe(2));
    // …and this checkout is still A and B, not C (R15).
    const items = screen.getByRole("list", { name: "checkout items" });
    expect(items).toHaveTextContent("AB");
    expect(items).not.toHaveTextContent("C");
  });
});
