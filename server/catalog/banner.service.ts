import { bannerRepository } from "@server/catalog/banner.repository";
import { isCompleteReorder } from "@server/catalog/banner.order";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { NotFoundError, DomainError } from "@server/shared/domain-error";
import { toInternalPath } from "@server/shared/internal-href";
import type { AdminBanner, BannerInput } from "@server/catalog/banner.types";
import type { BannerWrite } from "@server/catalog/banner.repository";
import { resolveImageSlot, type CurrentImage } from "@server/catalog/image-slot-write";
import { IMAGE_SLOT } from "@server/catalog/image-slots";

/**
 * Store the path, whatever was pasted.
 *
 * An absolute URL on our own origin is reduced; anything pointing elsewhere is refused
 * on the field rather than quietly rewritten, because a hero banner is the most
 * prominent surface the store has and a wrong destination there is expensive.
 */
function withInternalHrefs(data: BannerInput): BannerInput["actions"] {
  return data.actions.map((action, index) => {
      const href = toInternalPath(action.href);
      if (!href) {
        throw new DomainError(
          "A banner button can only point at a page on this site.",
          { status: 400, field: `actions.${index}.href` },
        );
      }
      return { ...action, href };
    });
}

/** Field by field: the payload is never spread into a write (Invariant 4). Home banners are the
 *  platform's, so their pictures come from the platform's library (null org). */
async function toWrite(data: BannerInput, current: CurrentImage | null): Promise<BannerWrite> {
  const actions = withInternalHrefs(data);
  const image = await resolveImageSlot(IMAGE_SLOT.HOME_BANNER, null, data.image, current);
  return {
    title: data.title,
    eyebrow: data.eyebrow,
    description: data.description,
    imageAlt: data.imageAlt,
    isActive: data.isActive,
    actions,
    ...image,
  };
}

class BannerService {
  listAll(): Promise<AdminBanner[]> {
    return bannerRepository.listAll();
  }

  async getById(id: string): Promise<AdminBanner> {
    const banner = await bannerRepository.findById(id);
    if (!banner) throw new NotFoundError("Banner not found");
    return banner;
  }

  async create(adminId: string, data: BannerInput): Promise<AdminBanner> {
    const banner = await bannerRepository.create(await toWrite(data, null));
    await recordAdminAction({
      adminId,
      action: "BANNER_CREATED",
      resource: "Banner",
      resourceId: banner.id,
      metadata: { title: banner.title },
    });
    return banner;
  }

  async update(
    adminId: string,
    id: string,
    data: BannerInput,
  ): Promise<AdminBanner> {
    const current = await this.getById(id);
    const banner = await bannerRepository.update(id, await toWrite(data, current));
    await recordAdminAction({
      adminId,
      action: "BANNER_UPDATED",
      resource: "Banner",
      resourceId: id,
      metadata: { title: banner.title },
    });
    return banner;
  }

  async setActive(
    adminId: string,
    id: string,
    isActive: boolean,
  ): Promise<AdminBanner> {
    await this.getById(id);
    const banner = await bannerRepository.setActive(id, isActive);
    await recordAdminAction({
      adminId,
      action: isActive ? "BANNER_ACTIVATED" : "BANNER_DEACTIVATED",
      resource: "Banner",
      resourceId: id,
      metadata: { title: banner.title },
    });
    return banner;
  }

  async delete(adminId: string, id: string): Promise<void> {
    const banner = await this.getById(id);
    await bannerRepository.delete(id);
    await recordAdminAction({
      adminId,
      action: "BANNER_DELETED",
      resource: "Banner",
      resourceId: id,
      metadata: { title: banner.title },
    });
  }

  /** The list must name every banner exactly once, or the rewrite would leave the
   *  unnamed ones holding an order that now collides with a named one. */
  async reorder(adminId: string, ids: string[]): Promise<void> {
    const total = await bannerRepository.countAll();
    if (!isCompleteReorder(ids, total)) {
      throw new DomainError("Reorder must list every banner exactly once");
    }
    await bannerRepository.reorder(ids);
    await recordAdminAction({
      adminId,
      action: "BANNERS_REORDERED",
      resource: "Banner",
      resourceId: ids[0] ?? "-",
      metadata: { order: ids },
    });
  }
}

export const bannerService = new BannerService();
