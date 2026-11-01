import { cache } from "react";
import { countNotPacked, listNotPacked, type NotPackedRow } from "@server/checkout/fulfilment-nudges";
import { listPickupQueue, pickupQueueCount, type PickupQueueRow, type PickupQueueTab } from "@server/checkout/pickup-queue";

/** The admin's pickup queue, read on the server (order-fulfilment ux.md "admin pickups", "admin not-packed flag"). */
class PickupsDAL {
  notPacked = cache(async (orgId?: string): Promise<NotPackedRow[]> => {
    return await listNotPacked({ orgId });
  });

  notPackedCount = cache(async (orgId?: string): Promise<number> => {
    return await countNotPacked({ orgId });
  });

  queue = cache(async (tab: PickupQueueTab, page: number, orgId?: string, city?: string): Promise<PickupQueueRow[]> => {
    return await listPickupQueue(tab, { page, orgId, city });
  });

  queueCount = cache(async (tab: PickupQueueTab, orgId?: string, city?: string): Promise<number> => {
    return await pickupQueueCount(tab, { orgId, city });
  });
}

export const pickupsDAL = new PickupsDAL();
