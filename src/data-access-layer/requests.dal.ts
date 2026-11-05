import { requestService } from "@server/requests/request.service";
import type { ShopTicketDTO } from "@server/requests/request.types";

/** What a shop's pages read of its tickets (setup-requests Q25). A failed read costs the list, not the page. */
export const requestsDAL = {
  async forShop(orgId: string, productIds?: readonly string[]): Promise<ShopTicketDTO[]> {
    try {
      return await requestService.forShop(orgId, { productIds, take: 25 });
    } catch (error) {
      console.error("[Requests] read failed:", error instanceof Error ? error.name : error);
      return [];
    }
  },
};
