import { cache } from "react";
import { listRefunds, refundCounts, type RefundRow } from "@server/checkout/refund-queue";

/** The admin's refunds, read on the server (order-fulfilment ux.md "admin refunds"). */
class RefundsDAL {
  page = cache(async (page: number): Promise<RefundRow[]> => {
    return await listRefunds(page);
  });

  counts = cache(async (): Promise<{ all: number; notStarted: number }> => {
    return await refundCounts();
  });
}

export const refundsDAL = new RefundsDAL();
