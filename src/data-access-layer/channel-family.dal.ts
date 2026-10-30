/**
 * What the family page reads (family-merge D2, D7): the listings read live through the channels
 * domain, the categories a new member may take, and the shop's name for the page.
 */

import { channelFamilyService } from "@server/channels/channel-family.service";
import type { FamilyPageDTO } from "@server/channels/channel-family.types";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import type { AdminCategory } from "@/domain/admin";

export const channelFamilyDAL = {
  /** Null when a listing is not this shop's. */
  async page(orgId: string, listingIds: string[]): Promise<{ detail: FamilyPageDTO; categories: Array<{ id: string; name: string }> } | null> {
    const [detail, categories] = await Promise.all([channelFamilyService.page(orgId, listingIds), adminCategoriesDAL.getCategories()]);
    if (!detail) return null;
    const byId = new Map(categories.categories.map((c: AdminCategory) => [c.id, c]));
    const named = categories.categories
      .map((c: AdminCategory) => ({ id: c.id, name: c.parentId && byId.get(c.parentId) ? `${byId.get(c.parentId)!.name} › ${c.name}` : c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { detail, categories: named };
  },
};
