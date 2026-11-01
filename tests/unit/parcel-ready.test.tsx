/**
 * order-fulfilment U2 without a database: the shop's "Ready for pickup" sheet and its refusals
 * (ux.md "Shop parcel"), the buyer trim (D7, A10), the notice emails as ux.md words them, and a
 * notice that is sent once even when its job is delivered twice (D8, A2).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const h = vi.hoisted(() => ({
  markReady: vi.fn(),
  refresh: vi.fn(),
  findById: vi.fn(),
  markSent: vi.fn(),
  send: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: h.refresh }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/org/parcels/parcelApiClient", () => ({ parcelApiClient: { markReady: h.markReady } }));
vi.mock("@server/notifications/notice.repository", () => ({
  noticeRepository: { findById: h.findById, markSent: h.markSent },
}));
vi.mock("resend", () => ({ Resend: class { emails = { send: h.send }; } }));
vi.mock("@server/identity/account.service", () => ({ accountService: {} }));

import { toast } from "sonner";
import { ApiError } from "@/lib/api-error";
import { ReadyForPickup } from "@/components/org/parcels/ready-for-pickup";
import { SHOP_PARCEL_COPY } from "@/components/org/parcels/parcel-copy";
import { toShopBuyer } from "@server/checkout/shop-parcel.types";
import { toShopOrderView } from "@server/checkout/admin.order.repository";
import { renderParcelNotice } from "@server/notifications/templates/parcelNoticeEmail";
import { NOTICE_KIND, type ParcelNoticeData } from "@server/notifications/notice.types";
import { noticeService } from "@server/notifications/notice.service";

const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("Ready for pickup (ux.md Shop parcel)", () => {
  beforeEach(() => vi.clearAllMocks());
  const show = () => render(<ReadyForPickup orgId="org_1" shipmentId="sh_1" firstOrder docked />);

  it("asks first, then marks ready with ux's toast; the button is never disabled", async () => {
    h.markReady.mockResolvedValue(undefined);
    show();
    expect(screen.getByText(SHOP_PARCEL_COPY.firstUseHint)).toBeTruthy();
    const button = screen.getByRole("button", { name: SHOP_PARCEL_COPY.ready });
    expect(button.hasAttribute("disabled")).toBe(false);

    press(SHOP_PARCEL_COPY.ready);
    expect(screen.getByText(SHOP_PARCEL_COPY.confirmTitle)).toBeTruthy();
    expect(h.markReady).not.toHaveBeenCalled();
    press(SHOP_PARCEL_COPY.confirmYes);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(SHOP_PARCEL_COPY.toast));
    expect(h.markReady).toHaveBeenCalledWith("org_1", "sh_1");
    expect(h.refresh).toHaveBeenCalled();
  });

  it("a cancelled parcel opens a sheet with the server's words and OK", async () => {
    const words = "This parcel was cancelled by the buyer on 3 Nov. Don't send it.";
    h.markReady.mockRejectedValue(new ApiError(words, 409));
    show();
    press(SHOP_PARCEL_COPY.ready);
    press(SHOP_PARCEL_COPY.confirmYes);
    expect(await screen.findByText(words)).toBeTruthy();
    expect(screen.getByRole("button", { name: SHOP_PARCEL_COPY.ok })).toBeTruthy();
  });

  it("another tab already marked it: the sheet says so and offers Refresh", async () => {
    h.markReady.mockRejectedValue(new ApiError("This parcel is already ready for pickup.", 409));
    show();
    press(SHOP_PARCEL_COPY.ready);
    press(SHOP_PARCEL_COPY.confirmYes);
    expect(await screen.findByText("This parcel is already ready for pickup.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  });

  it("a network failure is ux's retry toast, and the button stays", async () => {
    h.markReady.mockRejectedValue(new TypeError("Failed to fetch"));
    show();
    press(SHOP_PARCEL_COPY.ready);
    press(SHOP_PARCEL_COPY.confirmYes);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(SHOP_PARCEL_COPY.retry));
    expect(screen.getByRole("button", { name: SHOP_PARCEL_COPY.ready })).toBeTruthy();
  });
});

describe("the buyer as a shop sees them (D7, Q22, A10)", () => {
  const address = {
    fullName: "Asha Buyer", mobile: "+919812345678", email: "asha@example.com",
    addressLine1: "12 Secret Lane", landmark: "Behind the temple", city: "Pune", state: "MH", pincode: "411001",
  };

  it("keeps name, city and pincode and nothing else", () => {
    expect(toShopBuyer(address)).toEqual({ name: "Asha Buyer", city: "Pune", pincode: "411001" });
  });

  it("the order view carries no phone, street, landmark or email, and only the shop's parcels", () => {
    const view = toShopOrderView(
      {
        id: "o1", code: "BB-1", paidAt: new Date("2026-11-01T00:00:00Z"), address,
        shipments: [{ id: "s1", code: "BB-1-SH1", status: "packing", shippingCost: 0, courierName: null, trackingNumber: null, items: [] }],
      } as never,
      null,
    );
    const wire = JSON.stringify(view);
    for (const leak of ["9812345678", "Secret Lane", "temple", "asha@example.com", "mobile", "addressLine"]) {
      expect(wire).not.toContain(leak);
    }
    expect(view.parcels[0].position).toBe(1);
  });

  it("no shop-facing file selects or prints a buyer phone or street", () => {
    // A10 holds only if nothing org-facing reaches for them. Scans the shop's pages and components.
    const roots = ["src/app/(org)/org/[orgId]/orders", "src/components/org/parcels", "src/app/api/org/[orgId]/shipments"];
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((e) => {
        const p = join(dir, e);
        return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(e) ? [p] : [];
      });
    const files = roots.flatMap((root) => walk(root));
    expect(files.length).toBeGreaterThan(5);
    const offenders = files.filter((f) => /\.mobile\b|addressLine|formatPhone\(order|\.address\b/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("parcel notices (D8; ux.md Emails)", () => {
  const data: ParcelNoticeData = {
    orderId: "o1", orderCode: "BB-4821", parcelCode: "BB-4821-SH1", orgId: "org_1",
    shopName: "Noor Attar", city: "Mumbai", since: "2026-11-01T10:30:00.000Z",
  };

  it("words each email as ux.md has it", () => {
    expect(renderParcelNotice(NOTICE_KIND.READY, data).subject).toBe("Parcel ready to book — Noor Attar, Mumbai");
    expect(renderParcelNotice(NOTICE_KIND.READY, data).html).toContain("BB-4821-SH1 is packed. Book it on Shiprocket and enter the details.");
    expect(renderParcelNotice(NOTICE_KIND.READY_24H, data).subject).toBe("Waiting 24 h: parcel BB-4821-SH1");
    expect(renderParcelNotice(NOTICE_KIND.READY_24H, data).html).toContain("This parcel has been ready since 1 Nov, 4:00 pm. The shop is waiting.");
    expect(renderParcelNotice(NOTICE_KIND.NOT_READY_12H, data).subject).toBe("1 parcel waiting to be packed");
    expect(renderParcelNotice(NOTICE_KIND.NOT_READY_12H, data).html).toContain("BB-4821 was paid 12 hours ago. Tap Ready for pickup once it's packed.");
    expect(renderParcelNotice(NOTICE_KIND.NOT_READY_24H, data).html).toContain("BB-4821 was paid a day ago.");
    expect(renderParcelNotice(NOTICE_KIND.NOT_PACKED_ADMIN, { ...data, at: "2026-11-04T11:00:00.000Z" }).html).toContain("BB-4821 was paid 3 days ago.");
  });

  it("a shop email links to the parcel page, never a courier link (Q26)", () => {
    expect(renderParcelNotice(NOTICE_KIND.NOT_READY_12H, data).html).toContain("/org/org_1/orders/o1");
  });

  it("a notice delivered twice is sent once, keyed by its id (A2, A5)", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const row = { id: "n1", kind: NOTICE_KIND.READY, recipient: "support@bhendibazaar.com", data, sentAt: null as Date | null };
    h.findById.mockResolvedValueOnce(row).mockResolvedValueOnce({ ...row, sentAt: new Date() });
    h.send.mockResolvedValue({ data: { id: "e1" }, error: null });

    await noticeService.send("n1");
    await noticeService.send("n1");

    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.send.mock.calls[0][1]).toEqual({ idempotencyKey: "notice-n1" });
    expect(h.markSent).toHaveBeenCalledWith("n1");
  });
});
