/**
 * A late payment's refund on the admin's list (payment-confirmation/unmatched-payments ux.md):
 * no parcel, its own reason, and a start that does not claim the buyer was emailed.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { RefundList } from "@/components/order/refunds/refund-list";
import { REFUNDS_COPY } from "@/components/order/refunds/refunds-copy";
import type { RefundRow } from "@server/checkout/refund-queue";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => "/admin/orders/refunds", useSearchParams: () => new URLSearchParams() }));

const late: RefundRow = {
  id: "rf_1",
  orderId: "o_1",
  orderCode: "BB7K2Q",
  parcelCode: null,
  amountPaise: 220_72,
  cause: "paid_after_release",
  cancelledBy: null,
  state: "OWED",
  gatewayRefundId: null,
  failureReason: null,
  paymentId: "pay_U3KD1Y416pSs1e",
  owedDays: 0,
  startedDay: null,
};

describe("a late payment's refund on the list", () => {
  it("names why, shows no parcel, and offers the refund", () => {
    render(<RefundList rows={[late]} />);
    expect(screen.getAllByText("paid after release").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: REFUNDS_COPY.open(220_72) }).length).toBeGreaterThan(0);
  });

  it("does not say the buyer was emailed when there is no parcel notice to send (Q8)", () => {
    expect(REFUNDS_COPY.success(220_72, false)).not.toMatch(/emailed/i);
    expect(REFUNDS_COPY.success(220_72)).toMatch(/Buyer emailed\.$/);
  });
});
