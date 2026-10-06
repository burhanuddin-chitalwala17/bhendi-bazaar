import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "@/lib/api-error";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));
vi.mock("@/components/product/stockApiClient", () => ({
  stockApiClient: {
    check: vi.fn().mockRejectedValue(
      new ApiError("Validation failed", 400, [{ path: "items.0.quantity", message: "Too many" }]),
    ),
  },
}));

const { useCheckoutPayment } = await import("@/components/checkout/hooks/useCheckoutPayment");

// Since every client throws ApiError, a refused payload with field details takes the early
// branch of the catch. It used to return with `isProcessing` still true, leaving the Pay
// button disabled until a reload.
describe("a refused checkout payload", () => {
  it("shows the field messages and lets the buyer try again", async () => {
    const { result } = renderHook(() => useCheckoutPayment());

    await act(async () => {
      await result.current
        .processPaymentWithShipments({ shippingGroups: [], totals: { grandTotal: 0 } } as never)
        .catch(() => {});
    });

    expect(result.current.error).toBe("items.0.quantity: Too many");
    expect(result.current.isProcessing).toBe(false);
  });
});
