import { cache } from "react";
import { countNotPacked, listNotPacked, type NotPackedRow } from "@server/checkout/fulfilment-nudges";

/** The admin's pickup queue, read on the server (order-fulfilment ux.md "admin not-packed flag"). */
class PickupsDAL {
  notPacked = cache(async (orgId?: string): Promise<NotPackedRow[]> => {
    return await listNotPacked({ orgId });
  });

  notPackedCount = cache(async (orgId?: string): Promise<number> => {
    return await countNotPacked({ orgId });
  });
}

export const pickupsDAL = new PickupsDAL();
