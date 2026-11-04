import { cache } from "react";
import { shopSalesOverview } from "@server/analytics/sales.service";
import type { SalesPeriod, ShopSalesOverview } from "@server/analytics/sales.types";
import type { HomeRead } from "./home.dal";

/**
 * A shop's sales on its Home (design-system Q34): one statement a load, read live. Never through
 * `cachedRead`: money is never read from the storefront cache (ADR-0065). The caller has already
 * checked membership with `requireOrgMember`.
 */
export const orgSalesDAL = {
  forPeriod: cache(async (orgId: string, period: SalesPeriod): Promise<HomeRead<ShopSalesOverview>> => {
    try {
      return { ok: true, value: await shopSalesOverview(orgId, period) };
    } catch (error) {
      console.error("[Home] sales read failed:", error);
      return { ok: false };
    }
  }),
};
