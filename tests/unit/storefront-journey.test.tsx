/**
 * The store screens' guards (design-system Q19, Q20, Q21, Q25): each is a way a redesign quietly
 * regresses — a grid that downloads more than it shows, a tab bar that loses a tab, a checkout
 * that scolds before the buyer has tried, a delivery check that asks the courier about "12".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CartItem } from "@/domain/cart";

const { getRates, auth, pathname } = vi.hoisted(() => ({
  getRates: vi.fn(),
  auth: { user: null as null | { id: string } },
  pathname: { current: "/" },
}));

vi.mock("@/components/shipping/shippingApiClient", () => ({ shippingApiClient: { getRates } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: auth.user ? { user: auth.user } : null }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ status: "guest", user: null }) }));
vi.mock("@/context/AuthSheetContext", () => ({ useAuthSheet: () => ({ open: vi.fn() }) }));
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
  useCheckoutPayment: () => ({ processPaymentWithShipments: vi.fn(), isProcessing: false, error: null, setError: vi.fn() }),
}));
vi.mock("@/components/checkout/components/GuestAddress", () => ({ GuestAddress: () => null }));
vi.mock("@/components/checkout/components/CouponField", () => ({ CouponField: () => null }));
vi.mock("@/components/checkout/components/checkout-summary", () => ({ CheckoutSummary: () => null }));

import { PRODUCT_GRID_CLASSES } from "@/components/shared/product-grid";
import { PRODUCT_TILE_SIZES } from "@/components/shared/product-card";
import { MobileTabBar, SHOPPER_TABS } from "@/components/layout/mobile-tab-bar";
import { DeliveryCheck } from "@/components/product/delivery-check";
import { isPincode } from "@/hooks/product/useDeliveryCheck";
import { CheckoutContainer } from "@/components/checkout";
import { checkoutStepErrors } from "@/components/checkout/checkout-steps";
import { useCartStore } from "@/store/cartStore";

describe("the product grid and its image sizes move together (Q19)", () => {
  const columns = (prefix: string) => Number(PRODUCT_GRID_CLASSES.match(new RegExp(`(?:^|\\s)${prefix}grid-cols-(\\d)`))?.[1]);
  const slot = (query: string | null) => {
    const entries = PRODUCT_TILE_SIZES.split(",").map((s) => s.trim());
    return query ? entries.find((e) => e.startsWith(query))!.split(") ")[1] : entries[entries.length - 1];
  };

  it("phone 2-up, tablet 3-up, desktop 4-up", () => {
    expect([columns(""), columns("md:"), columns("lg:")]).toEqual([2, 3, 4]);
  });

  it("asks for no more than a column's width at each form factor", () => {
    expect(slot(null)).toBe(`${100 / columns("")}vw`);
    expect(slot("(min-width: 768px)")).toBe(`${Math.round(100 / columns("md:"))}vw`);
    // The 90rem page split four ways is 360px before gaps; asking more is the 1600px tile.
    expect(parseInt(slot("(min-width: 1024px)"), 10)).toBeLessThanOrEqual(1440 / columns("lg:"));
  });
});

describe("the phone tab bar (Q21, Q20)", () => {
  beforeEach(() => {
    pathname.current = "/";
  });

  it("is Home · Shop · Saved · Bag · Account", () => {
    expect(SHOPPER_TABS.map((tab) => tab.label)).toEqual(["Home", "Shop", "Saved", "Bag", "Account"]);
    auth.user = { id: "u1" };
    render(<MobileTabBar />);
    expect(screen.getByRole("link", { name: /Saved/ }).getAttribute("href")).toBe("/wishlist");
    expect(screen.getByRole("link", { name: /Bag/ }).getAttribute("href")).toBe("/cart");
  });

  it("is absent in checkout, which has its own way back", () => {
    pathname.current = "/checkout";
    const { container } = render(<MobileTabBar />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the delivery check (Q25)", () => {
  beforeEach(() => {
    getRates.mockReset();
    window.localStorage.clear();
  });

  it("accepts six digits not starting with 0, and nothing else", () => {
    expect(["400003", "110001"].every(isPincode)).toBe(true);
    expect(["12", "4000031", "040003", "40OO03", ""].some(isPincode)).toBe(false);
  });

  it("refuses a short PIN code without asking the courier", async () => {
    render(<DeliveryCheck fromPincode="400003" weight={0.5} />);
    fireEvent.change(screen.getByLabelText("Check delivery"), { target: { value: "4000" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Enter a 6-digit PIN code.")).toBeInTheDocument();
    expect(getRates).not.toHaveBeenCalled();
  });

  it("says when a PIN code is not served, rather than failing", async () => {
    const { ApiError } = await import("@/lib/api-error");
    getRates.mockRejectedValue(new ApiError("none", 404, []));
    render(<DeliveryCheck fromPincode="400003" weight={0.5} />);
    fireEvent.change(screen.getByLabelText("Check delivery"), { target: { value: "799001" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText(/doesn.t deliver to/)).toBeInTheDocument();
  });
});

describe("checkout errors wait for Pay (Q20)", () => {
  beforeEach(() => {
    useCartStore.getState().setItems([{ id: "l1", productId: "p1", quantity: 1, price: 1000, productName: "Rida" } as CartItem]);
    useCartStore.setState({ hasHydrated: true });
  });

  it("shows nothing wrong before Pay, and the missing address beside its step after", async () => {
    render(<CheckoutContainer />);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Pay/ }));
    const step = screen.getByRole("region", { name: /Deliver to/ });
    await waitFor(() => expect(step).toHaveTextContent("Add where we should deliver."));
  });

  it("names the parcels still without a delivery choice", () => {
    const groups = [{ selectedRate: null }, { selectedRate: null }];
    expect(checkoutStepErrors({ hasAddress: true, shippingLoading: false, groups }).delivery).toBe("Choose delivery for 2 parcels.");
    expect(checkoutStepErrors({ hasAddress: false, shippingLoading: false, groups }).address).not.toBeNull();
  });
});
