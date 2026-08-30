import { bannerRepository } from "@server/catalog/banner.repository";
import { isCompleteReorder } from "@server/catalog/banner.order";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { NotFoundError, DomainError } from "@server/shared/domain-error";
import type { AdminBanner, BannerInput } from "@server/catalog/banner.types";

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
    const banner = await bannerRepository.create(data);
    await recordAdminAction({
      adminId,
      action: "BANNER_CREATED",
      resource: "Banner",
      resourceId: banner.id,
      metadata: { title: banner.title },
    });
    return banner;
  }

  async update(adminId: string, id: string, data: BannerInput): Promise<AdminBanner> {
    await this.getById(id);
    const banner = await bannerRepository.update(id, data);
    await recordAdminAction({
      adminId,
      action: "BANNER_UPDATED",
      resource: "Banner",
      resourceId: id,
      metadata: { title: banner.title },
    });
    return banner;
  }

  async setActive(adminId: string, id: string, isActive: boolean): Promise<AdminBanner> {
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
