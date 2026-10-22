/**
 * What the Settle page reads (product-merge D2, UI approach): the listing read live through the
 * channels domain, the categories a new product may take, and the org code its photo paths carry.
 */

import { channelSettleService } from "@server/channels/channel-settle.service";
import type { SettleDetailDTO } from "@server/channels/channel-connection.types";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import type { AdminCategory } from "@/domain/admin";

export interface SettlePageData {
  detail: SettleDetailDTO;
  categories: Array<{ id: string; name: string }>;
  orgCode: string;
}

export const channelSettleDAL = {
  /** Null when the listing or product is not this shop's. */
  async page(orgId: string, listingId: string, productId: string | null): Promise<SettlePageData | null> {
    const [detail, categories, org] = await Promise.all([
      channelSettleService.page(orgId, listingId, productId),
      adminCategoriesDAL.getCategories(),
      orgsDAL.getOrgSummary(orgId),
    ]);
    if (!detail || !org) return null;
    const byId = new Map(categories.categories.map((c: AdminCategory) => [c.id, c]));
    // A category reads with its parent, as the product form's picker shows it.
    const named = categories.categories
      .map((c: AdminCategory) => ({ id: c.id, name: c.parentId && byId.get(c.parentId) ? `${byId.get(c.parentId)!.name} › ${c.name}` : c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { detail, categories: named, orgCode: org.code };
  },
};
