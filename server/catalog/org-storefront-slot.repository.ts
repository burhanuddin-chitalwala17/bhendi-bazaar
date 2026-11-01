/**
 * The photos and picked categories a themed page draws (storefront-themes D13, Q10). The only module
 * touching `prisma.orgStorefrontSlot` (Invariant 5); every method is scoped to one org.
 */

import { StorefrontSlotKind, type Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";

type SlotDb = Pick<Prisma.TransactionClient, "orgStorefrontSlot">;

export interface SlotWrite {
  categoryId: string | null;
  assetId: string | null;
}

export { StorefrontSlotKind };

export const orgStorefrontSlotRepository = {
  /** Both kinds in position order, with the photo's URL and the category's identity. */
  async listForOrg(orgId: string, db: SlotDb = prisma) {
    return await db.orgStorefrontSlot.findMany({
      where: { orgId },
      orderBy: [{ kind: "asc" }, { position: "asc" }],
      select: {
        kind: true,
        position: true,
        asset: { select: { ref: true } },
        category: { select: { id: true, slug: true, name: true, heroImage: true } },
      },
    });
  },

  /** How many shops show this category as a collection; a category they point at cannot be deleted. */
  async countShopsShowingCategory(categoryId: string) {
    const rows = await prisma.orgStorefrontSlot.findMany({
      where: { categoryId },
      distinct: ["orgId"],
      select: { orgId: true },
    });
    return rows.length;
  },

  /**
   * One kind's slots replaced by these, in order, inside the caller's transaction: the save is a
   * list the shop arranged, so it lands whole or not at all.
   */
  async replaceKind(orgId: string, kind: StorefrontSlotKind, slots: readonly SlotWrite[], db: SlotDb) {
    await db.orgStorefrontSlot.deleteMany({ where: { orgId, kind } });
    if (!slots.length) return;
    await db.orgStorefrontSlot.createMany({
      data: slots.map((slot, position) => ({ orgId, kind, position, categoryId: slot.categoryId, assetId: slot.assetId })),
    });
  },
};
