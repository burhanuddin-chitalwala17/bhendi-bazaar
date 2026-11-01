/**
 * order-fulfilment U5 without a database: the cancel sheets (ux.md "Shop cancel sheet", "buyer
 * cancel sheet"), A7 (a ready parcel's Cancel explains, it is never a dead button), the reason
 * rules (Q21), the fee field's bounds (D14), the buyer's cancelled timeline line, and the cancel
 * emails as ux.md words them — the fee line only on a shop's own cancel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ cancel: vi.fn(), buyerCancel: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: h.refresh }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }));
vi.mock("@/components/org/parcels/parcelApiClient", () => ({ parcelApiClient: { cancel: h.cancel } }));
vi.mock("@/components/order/orderApiClient", () => ({ orderApiClient: { cancelParcel: h.buyerCancel } }));
vi.mock("@/components/support/contact-sheet", () => ({ ContactSheet: () => null }));

import { toast } from "sonner";
import { ApiError } from "@/lib/api-error";
import { CancelParcel } from "@/components/org/parcels/cancel-parcel";
import { SHOP_CANCEL_COPY } from "@/components/org/parcels/parcel-copy";
import { BuyerCancel } from "@/components/order/buyer-cancel";
import { BUYER_CANCEL_COPY } from "@/components/order/buyer-cancel-copy";
import { CANCEL_RETRY } from "@/components/order/cancel/useCancelForm";
import { CANCEL_ERRORS, buyerCancelSchema, shopCancelReason, shopCancelSchema } from "@/lib/validation/schemas/parcel-cancel.schema";
import { FEE_ERROR, fulfilmentFeeSchema } from "@/lib/validation/schemas/fulfilment-settings.schema";
import { CANCEL_REFUSAL, PARCEL_REFUND } from "@server/checkout/parcel-cancel.types";
import { renderParcelNotice } from "@server/notifications/templates/parcelNoticeEmail";
import { NOTICE_KIND, type ParcelNoticeData } from "@server/notifications/notice.types";
import { timelineLine, TIMELINE_READER } from "@/components/order/timeline/timeline-copy";
import { PARCEL_ACTOR, SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { PickupActions } from "@/components/order/pickups/pickup-actions";
import { ADMIN_CANCEL_COPY } from "@/components/order/pickups/pickups-copy";

const press = (name: string) => fireEvent.click(screen.getAllByRole("button", { name }).at(-1)!);

describe("shop cancel sheet (ux.md, R10, R12a)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("A7: Cancel on a ready parcel opens the explanation with Contact us, and sends nothing", () => {
    render(<CancelParcel orgId="o" shipmentId="s" packing={false} feeNowPaise={5_000} />);
    const button = screen.getByRole("button", { name: SHOP_CANCEL_COPY.open });
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);
    expect(screen.getByText(SHOP_CANCEL_COPY.afterReady)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Contact us" })).toBeTruthy();
    expect(h.cancel).not.toHaveBeenCalled();
  });

  it("names no fee when the admin has set it to ₹0", () => {
    expect(SHOP_CANCEL_COPY.intro(0)).toBe("Why are you cancelling? The buyer gets a full refund.");
  });

  it("asks for a reason first, names the fee, then cancels with ux's toast", async () => {
    h.cancel.mockResolvedValue({ feePaise: 5_000 });
    render(<CancelParcel orgId="o" shipmentId="s" packing feeNowPaise={5_000} />);
    press(SHOP_CANCEL_COPY.open);
    expect(screen.getByText(SHOP_CANCEL_COPY.intro(5_000))).toBeTruthy();
    press(SHOP_CANCEL_COPY.confirm);
    expect(await screen.findByText(CANCEL_ERRORS.pickReason)).toBeTruthy();
    expect(h.cancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "Out of stock" }));
    press(SHOP_CANCEL_COPY.confirm);
    await waitFor(() => expect(h.cancel).toHaveBeenCalledWith("o", "s", { reason: "out_of_stock" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Parcel cancelled. Stock is back on sale and the buyer will be refunded. ₹50 cancellation fee taken from your earnings.",
      ),
    );
  });

  it("the buyer got there first: the server's words replace the list, with OK", async () => {
    h.cancel.mockRejectedValue(new ApiError(CANCEL_REFUSAL.shopBuyerFirst, 409));
    render(<CancelParcel orgId="o" shipmentId="s" packing feeNowPaise={5_000} />);
    press(SHOP_CANCEL_COPY.open);
    fireEvent.click(screen.getByRole("radio", { name: "Item damaged" }));
    press(SHOP_CANCEL_COPY.confirm);
    expect(await screen.findByText(CANCEL_REFUSAL.shopBuyerFirst)).toBeTruthy();
    expect(screen.getByRole("button", { name: "OK" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Item damaged" })).toBeNull();
  });

  it("a server failure is ux's retry line, and the sheet stays", async () => {
    h.cancel.mockRejectedValue(new ApiError("boom", 500));
    render(<CancelParcel orgId="o" shipmentId="s" packing feeNowPaise={5_000} />);
    press(SHOP_CANCEL_COPY.open);
    fireEvent.click(screen.getByRole("radio", { name: "Price was wrong" }));
    press(SHOP_CANCEL_COPY.confirm);
    expect(await screen.findByText(CANCEL_RETRY)).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Price was wrong" })).toBeTruthy();
  });
});

describe("buyer cancel sheet (ux.md, Q13, Q21)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("names the amount; one parcel reads 'Cancel order', the reason is optional", async () => {
    h.buyerCancel.mockResolvedValue({ refundPaise: 124_000 });
    render(<BuyerCancel orderId="ord" shipmentId="s" packing multiParcel={false} shopName="Zari Works" refundPaise={124_000} />);
    press(BUYER_CANCEL_COPY.cancelOrder);
    expect(screen.getByText("Cancel this order? You'll get ₹1,240 back to the way you paid.")).toBeTruthy();
    press(BUYER_CANCEL_COPY.confirm);
    await waitFor(() => expect(h.buyerCancel).toHaveBeenCalledWith("ord", "s", {}));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(BUYER_CANCEL_COPY.success));
  });

  it("a multi-parcel order names the shop; a packed parcel explains and points to Contact us", () => {
    const { unmount } = render(<BuyerCancel orderId="ord" shipmentId="s" packing multiParcel shopName="Zari Works" refundPaise={50_000} />);
    press(BUYER_CANCEL_COPY.cancelItems);
    expect(screen.getByText("Cancel the items from Zari Works? You'll get ₹500 back.")).toBeTruthy();
    unmount();

    render(<BuyerCancel orderId="ord" shipmentId="s" packing={false} multiParcel={false} shopName={null} refundPaise={0} />);
    press(BUYER_CANCEL_COPY.cancelOrder);
    expect(screen.getByText(BUYER_CANCEL_COPY.afterReady)).toBeTruthy();
    expect(h.buyerCancel).not.toHaveBeenCalled();
  });

  it("the shop packed it meanwhile: the refusal offers Contact us", async () => {
    h.buyerCancel.mockRejectedValue(new ApiError(CANCEL_REFUSAL.buyerShopPacked, 409));
    render(<BuyerCancel orderId="ord" shipmentId="s" packing multiParcel={false} shopName={null} refundPaise={1} />);
    press(BUYER_CANCEL_COPY.cancelOrder);
    press(BUYER_CANCEL_COPY.confirm);
    expect(await screen.findByText(CANCEL_REFUSAL.buyerShopPacked)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Contact us" })).toBeTruthy();
  });
});

describe("admin cancel after booking (ux.md 'admin cancel sheet')", () => {
  const cancelled = { shipmentId: "s", status: SHIPMENT_STATUS.CANCELLED, courierName: null, pickupDate: null, pickupDay: null, estimatedDelivery: null };

  it("the Shiprocket reminder stays on the booked parcel's row, read from its AWB, not a toast", () => {
    const { container, rerender } = render(<PickupActions parcel={{ ...cancelled, trackingNumber: "AWB123" }} />);
    expect(screen.getByText(ADMIN_CANCEL_COPY.successBooked("AWB123"))).toBeTruthy();
    expect(screen.getByRole("link", { name: ADMIN_CANCEL_COPY.openShiprocket })).toBeTruthy();
    rerender(<PickupActions parcel={{ ...cancelled, trackingNumber: null }} />);
    expect(container.textContent).toBe("");
  });
});

describe("cancel inputs (Q21, D14)", () => {
  it("the shop and admin must give a reason, and 'Other' needs words", () => {
    expect(shopCancelSchema.safeParse({}).success).toBe(false);
    expect(shopCancelSchema.safeParse({ reason: "other" }).success).toBe(false);
    expect(shopCancelSchema.safeParse({ reason: "other", other: "   " }).success).toBe(false);
    expect(shopCancelReason(shopCancelSchema.parse({ reason: "other", other: " Supplier late " }))).toBe("Supplier late");
    expect(shopCancelReason(shopCancelSchema.parse({ reason: "no_time" }))).toBe("Can't make it in time");
    expect(shopCancelSchema.safeParse({ reason: "other", other: "x".repeat(121) }).success).toBe(false);
  });

  it("a money field in the body is not an input: the schema strips it", () => {
    expect(shopCancelSchema.parse({ reason: "damaged", feePaise: 0, refundPaise: 999 })).toEqual({ reason: "damaged" });
    expect(buyerCancelSchema.parse({ refundPaise: 1 })).toEqual({});
  });

  it("A12: the fee is whole rupees from ₹0 to ₹1,000", () => {
    const fee = (feeRupees: unknown) => fulfilmentFeeSchema.safeParse({ feeRupees, seenVersion: 0 });
    expect(fee(75).success).toBe(true);
    expect(fee(0).success).toBe(true);
    expect(fee(1000).success).toBe(true);
    for (const bad of [-1, 1001, 7.5, Number.NaN, "75"]) {
      const result = fee(bad);
      expect(result.success, String(bad)).toBe(false);
      if (!result.success) expect(result.error.issues[0].message).toBe(FEE_ERROR);
    }
  });
});

describe("cancel wording (ux.md Timeline wording, Emails)", () => {
  const data: ParcelNoticeData = {
    orderId: "ord", orderCode: "BB-4821", parcelCode: "BB-4821-SH1", orgId: "o", shopName: "Zari Works",
    city: "Mumbai", since: new Date().toISOString(), refundPaise: 124_000, feePaise: 5_000,
  };

  it("the buyer hears who cancelled and the refund; the shop hears the fee only when it cancelled", () => {
    const buyer = renderParcelNotice(NOTICE_KIND.CANCELLED_BUYER, { ...data, cancelledBy: PARCEL_ACTOR.SHOP });
    expect(buyer.subject).toBe("Order BB-4821 cancelled");
    expect(buyer.html).toContain("Zari Works cancelled your items. Your refund of ₹1,240 is on its way.");

    const shopOwn = renderParcelNotice(NOTICE_KIND.CANCELLED_SHOP, { ...data, cancelledBy: PARCEL_ACTOR.SHOP });
    expect(shopOwn.subject).toBe("Parcel BB-4821-SH1 cancelled");
    expect(shopOwn.html).toContain("Don't send this parcel. Its stock is back on sale. ₹50 cancellation fee taken from your earnings.");

    const byBuyer = renderParcelNotice(NOTICE_KIND.CANCELLED_SHOP, { ...data, cancelledBy: PARCEL_ACTOR.BUYER });
    expect(byBuyer.html).not.toContain("cancellation fee");
  });

  it("the buyer's timeline names the refund's state", () => {
    const entry = {
      kind: "move", status: SHIPMENT_STATUS.CANCELLED, actor: PARCEL_ACTOR.BUYER, reason: null, courierWording: null,
      pickupDate: null, estimatedDelivery: null, actorName: null, at: "", day: "3 Nov", time: "10:00", ageHours: 0,
    } as unknown as Parameters<typeof timelineLine>[1];
    const timeline = { courierName: null, trackingNumber: null, entries: [entry] };
    expect(timelineLine(TIMELINE_READER.BUYER, entry, timeline)).toBe("Cancelled");
    expect(timelineLine(TIMELINE_READER.BUYER, entry, { ...timeline, refund: PARCEL_REFUND.OWED })).toBe("Cancelled · refund on its way");
    expect(timelineLine(TIMELINE_READER.BUYER, entry, { ...timeline, refund: PARCEL_REFUND.STARTED })).toBe("Cancelled · refund started");
  });
});
