import { cache } from "react";
import { adminOrderRepository } from "@server/checkout/admin.order.repository";
import {
  SHOP_PARCELS_PAGE,
  SHOP_PARCEL_TAB,
  SHOP_TAB_STATUSES,
  type ShopOrderView,
  type ShopParcelTab,
} from "@server/checkout/shop-parcel.types";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { parcelTimelines, type ParcelTimelineDto } from "@server/checkout/parcel-timeline";
import { shopCancelFees } from "@server/checkout/shop-cancel-fees";

export type { ShopOrderView, ShopParcelView, ShopParcelTab } from "@server/checkout/shop-parcel.types";

const ALL_STATUSES = Object.values(SHIPMENT_STATUS);

/**
 * What a shop may know about the orders it part-fulfils (order-fulfilment D7): its own parcels
 * on paid orders, the buyer as name, city and pincode — never phone or street (Q22, A10), never
 * the basket's other parcels or its totals.
 */
class OrgOrdersDAL {
  /** The first `pages` pages of one tab ("Load more" grows it); "To pack" oldest first, the rest newest first. */
  list = cache(async (orgId: string, tab: ShopParcelTab | "all", pages = 1, search?: string) => {
    const statuses = tab === "all" ? ALL_STATUSES : SHOP_TAB_STATUSES[tab];
    const { rows, total } = await adminOrderRepository.listShopOrders(orgId, statuses, {
      page: 1,
      limit: pages * SHOP_PARCELS_PAGE,
      search,
      oldestFirst: tab === SHOP_PARCEL_TAB.TO_PACK,
    });
    return { orders: rows, total, hasMore: pages * SHOP_PARCELS_PAGE < total };
  });

  /**
   * What waits under each working tab, for its count. Done and Cancelled only grow, so they carry
   * none. One row per tab is read; the count is the repository's own total.
   */
  tabCounts = cache(async (orgId: string): Promise<Partial<Record<ShopParcelTab, number>>> => {
    const tabs = [SHOP_PARCEL_TAB.TO_PACK, SHOP_PARCEL_TAB.READY, SHOP_PARCEL_TAB.ON_THE_WAY] as const;
    const totals = await Promise.all(
      tabs.map((tab) => adminOrderRepository.listShopOrders(orgId, SHOP_TAB_STATUSES[tab], { page: 1, limit: 1, oldestFirst: false })),
    );
    return Object.fromEntries(tabs.map((tab, i) => [tab, totals[i].total]));
  });

  getOrder = cache(async (orderId: string, orgId: string): Promise<ShopOrderView | null> => {
    return await adminOrderRepository.getShopOrder(orderId, orgId);
  });

  /** The timeline of each of this shop's parcels in the order (R7); read after `getOrder` scoped them. */
  timelines = cache(async (orderId: string, orgId: string): Promise<Record<string, ParcelTimelineDto>> => {
    const order = await this.getOrder(orderId, orgId);
    return order ? await parcelTimelines(order.parcels) : {};
  });

  /**
   * What cancelling costs this shop (D14): the fee a cancel would charge now, and what each of its
   * cancelled parcels in the order was charged.
   */
  cancelFees = cache(async (orderId: string, orgId: string): Promise<{ feePaise: number; charged: Record<string, number> }> => {
    const order = await this.getOrder(orderId, orgId);
    return await shopCancelFees((order?.parcels ?? []).map((p) => p.id));
  });
}

export const orgOrdersDAL = new OrgOrdersDAL();
