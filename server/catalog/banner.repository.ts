/**
 * The one repository for the Banner aggregate — the banner and its actions, which have
 * no life apart from it (ADR-0003).
 */

import { cache } from "react";
import { prisma } from "@server/shared/prisma";
import type { AdminBanner, BannerInput } from "@server/catalog/banner.types";
import { nextBannerOrder } from "@server/catalog/banner.order";

const SELECT = {
  id: true,
  title: true,
  eyebrow: true,
  description: true,
  imageUrl: true,
  imageAlt: true,
  order: true,
  isActive: true,
  actions: {
    select: { id: true, label: true, href: true, variant: true },
    orderBy: { order: "asc" },
  },
} as const;

class BannerRepository {
  /** The storefront read. Memoised per request like every other hot read. The nested
   *  `actions` load with the banner in one LATERAL JOIN, not a second statement — this
   *  runs on every homepage render. */
  listActive = cache(async (): Promise<AdminBanner[]> => {
    return prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: SELECT,
      relationLoadStrategy: "join",
    });
  });

  async listAll(): Promise<AdminBanner[]> {
    return prisma.banner.findMany({
      orderBy: { order: "asc" },
      select: SELECT,
      relationLoadStrategy: "join",
    });
  }

  async findById(id: string): Promise<AdminBanner | null> {
    return prisma.banner.findUnique({
      where: { id },
      select: SELECT,
      relationLoadStrategy: "join",
    });
  }

  /** Appends. `order` is never taken from the caller — only `reorder` sets it. */
  async create(data: BannerInput): Promise<AdminBanner> {
    const last = await prisma.banner.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const { actions, ...banner } = data;
    return prisma.banner.create({
      data: {
        ...banner,
        order: nextBannerOrder(last?.order),
        actions: { create: actions.map((a, i) => ({ ...a, order: i })) },
      },
      select: SELECT,
    });
  }

  /** Actions are replaced wholesale: they are ordered and unnamed, so diffing them
   *  by index would rename rows rather than move them. */
  async update(id: string, data: BannerInput): Promise<AdminBanner> {
    const { actions, ...banner } = data;
    return prisma.$transaction(async (tx) => {
      await tx.bannerAction.deleteMany({ where: { bannerId: id } });
      return tx.banner.update({
        where: { id },
        data: {
          ...banner,
          actions: { create: actions.map((a, i) => ({ ...a, order: i })) },
        },
        select: SELECT,
      });
    });
  }

  async setActive(id: string, isActive: boolean): Promise<AdminBanner> {
    return prisma.banner.update({ where: { id }, data: { isActive }, select: SELECT });
  }

  async delete(id: string): Promise<void> {
    await prisma.banner.delete({ where: { id } });
  }

  /** One transaction for the whole set: a half-applied reorder is a duplicate order
   *  value, and the column is only unique by convention. */
  async reorder(ids: string[]): Promise<void> {
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.banner.update({ where: { id }, data: { order: index } })
      )
    );
  }

  async countAll(): Promise<number> {
    return prisma.banner.count();
  }
}

export const bannerRepository = new BannerRepository();
