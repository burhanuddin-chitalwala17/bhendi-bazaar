/**
 * An org's own storefront banners (storefront-branding R2a–R2d).
 *
 * The only module touching `prisma.orgBanner` (Invariant 5). Every method takes an
 * `orgId` and filters on it — not because a caller might pass the wrong id, but so that
 * passing none is impossible: a banner query that is not scoped does not exist here.
 */

import { prisma } from "@server/shared/prisma";

export interface OrgBannerInput {
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  href: string | null;
  isActive: boolean;
}

export const orgBannerRepository = {
  /** Everything this org has, live or taken down, in its chosen order. */
  async listForOrg(orgId: string) {
    return await prisma.orgBanner.findMany({
      where: { orgId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
  },

  /** What a visitor sees: the live ones, in order. */
  async listActiveForOrg(orgId: string) {
    return await prisma.orgBanner.findMany({
      where: { orgId, isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        imageAlt: true,
        href: true,
      },
    });
  },

  /**
   * Append. `order` is server-owned — a create goes to the end and only a reorder
   * rewrites it, so a client cannot claim a position by sending one.
   */
  async create(orgId: string, data: OrgBannerInput) {
    const last = await prisma.orgBanner.findFirst({
      where: { orgId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return await prisma.orgBanner.create({
      data: { ...data, orgId, order: (last?.order ?? -1) + 1 },
    });
  },

  /**
   * Update one, scoped.
   *
   * `updateMany` with the org in the where rather than `update` by id: an id belonging
   * to another org matches nothing and changes nothing, instead of updating a row this
   * caller was never entitled to.
   */
  async update(orgId: string, id: string, data: Partial<OrgBannerInput>) {
    const result = await prisma.orgBanner.updateMany({ where: { id, orgId }, data });
    return result.count === 1;
  },

  async remove(orgId: string, id: string) {
    const result = await prisma.orgBanner.deleteMany({ where: { id, orgId } });
    return result.count === 1;
  },

  /** Rewrite the running order, in one transaction so no intermediate state shows. */
  async reorder(orgId: string, ids: string[]) {
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.orgBanner.updateMany({ where: { id, orgId }, data: { order: index } })
      )
    );
  },
};
