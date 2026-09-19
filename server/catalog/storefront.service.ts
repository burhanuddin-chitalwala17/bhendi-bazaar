/**
 * What an org may change about its own shop (org-storefront/storefront-branding).
 *
 * Two operations that look alike and are not: composing a storefront is an ordinary
 * edit, while changing a handle moves a public address and is its own authorised act
 * with its own consequences (ADR-0030 decision 4). Keeping them apart here is what
 * stops a handle riding along in an update payload.
 */

import { orgRepository } from "@server/catalog/org.repository";
import {
  orgBannerRepository,
  type OrgBannerInput,
} from "@server/catalog/org-banner.repository";
import { productsRepository } from "@server/catalog/product.repository";
import {
  handleCandidates,
  holdCutoff,
  holdExpiresAt,
  isReservedHandle,
} from "@server/catalog/org.handle";
import { isUniqueViolation } from "@server/shared/slug";
import {
  ConflictError,
  DomainError,
  NotFoundError,
} from "@server/shared/domain-error";
import { isValidSlug } from "@server/shared/slug";

export interface StorefrontSettingsInput {
  tagline?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  heroUrl?: string | null;
  accent?: string | null;
  deliveryPolicy?: string | null;
  returnsPolicy?: string | null;
}

export interface BannerInput {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  href?: string | null;
  isActive?: boolean;
}

/** Empty strings from a form mean "cleared", not "set to nothing". */
const orNull = (value: string | null | undefined) => value?.trim() || null;

/** Whitelisted field by field — the payload is never spread into a write. */
function normaliseBanner(input: BannerInput): OrgBannerInput {
  return {
    title: input.title.trim(),
    description: orNull(input.description),
    imageUrl: orNull(input.imageUrl),
    imageAlt: orNull(input.imageAlt),
    href: orNull(input.href),
    isActive: input.isActive ?? true,
  };
}

export const storefrontService = {
  /** This org's storefront as it stands, for its own editor. */
  async getSettings(orgId: string) {
    const settings = await orgRepository.findStorefrontSettings(orgId);
    if (!settings) throw new NotFoundError("Organisation not found");
    return settings;
  },

  /**
   * Save what an org composed.
   *
   * Every field is whitelisted by name — the payload is never spread into the write,
   * so a `handle` or a `commissionBps` arriving here reaches nothing (Invariant 4).
   */
  async saveSettings(orgId: string, input: StorefrontSettingsInput) {
    await orgRepository.updateStorefront(orgId, {
      tagline: orNull(input.tagline),
      description: orNull(input.description),
      logoUrl: orNull(input.logoUrl),
      heroUrl: orNull(input.heroUrl),
      accent: orNull(input.accent),
      deliveryPolicy: orNull(input.deliveryPolicy),
      returnsPolicy: orNull(input.returnsPolicy),
    });
    return await this.getSettings(orgId);
  },

  /**
   * What an owner is told before they confirm a handle change (org-handle R4g).
   *
   * Returned rather than composed in the UI so the date the old address dies is
   * computed from the same window the server enforces — a warning that disagrees with
   * the behaviour is worse than none.
   */
  previewChange(currentHandle: string) {
    const from = new Date();
    return {
      current: currentHandle,
      oldAddressWorksUntil: holdExpiresAt(from).toISOString(),
    };
  },

  /**
   * Move this org to a new handle.
   *
   * Refuses before writing where a refusal is a fact about the world rather than a
   * race: a malformed handle, a reserved word, the handle it already has, or one
   * another org is still holding. Genuine contention — two orgs claiming the same free
   * handle at once — is left to the unique constraint and retried, because a prior
   * "is it free?" is stale the instant it is answered.
   */
  async changeHandle(orgId: string, requested: string) {
    const settings = await orgRepository.findStorefrontSettings(orgId);
    if (!settings) throw new NotFoundError("Organisation not found");

    const next = requested.trim().toLowerCase();
    if (!isValidSlug(next)) {
      throw new DomainError(
        "A handle can use lowercase letters, numbers and hyphens only.",
        { status: 400, field: "handle" }
      );
    }
    if (isReservedHandle(next)) {
      throw new ConflictError("That address is reserved by the platform.");
    }
    if (next === settings.handle) {
      throw new ConflictError("That is already this shop's address.");
    }
    if (await orgRepository.isHandleHeldByAnother(next, orgId, holdCutoff())) {
      // Held, not free: another shop left it recently and can still take it back.
      throw new ConflictError("That address is not available.");
    }

    try {
      return await orgRepository.changeHandle(orgId, settings.handle, next);
    } catch (error) {
      if (isUniqueViolation(error, "handle")) {
        throw new ConflictError("That address is not available.");
      }
      throw error;
    }
  },

  /** This org's banners, live and taken down, for its own editor. */
  async listBanners(orgId: string) {
    return await orgBannerRepository.listForOrg(orgId);
  },

  async addBanner(orgId: string, input: BannerInput) {
    await this.assertHrefIsOwn(orgId, input.href);
    return await orgBannerRepository.create(orgId, normaliseBanner(input));
  },

  async editBanner(orgId: string, id: string, input: BannerInput) {
    await this.assertHrefIsOwn(orgId, input.href);
    const updated = await orgBannerRepository.update(orgId, id, normaliseBanner(input));
    if (!updated) throw new NotFoundError("Banner not found");
  },

  async removeBanner(orgId: string, id: string) {
    const removed = await orgBannerRepository.remove(orgId, id);
    if (!removed) throw new NotFoundError("Banner not found");
  },

  async reorderBanners(orgId: string, ids: string[]) {
    await orgBannerRepository.reorder(orgId, ids);
  },

  /**
   * A banner points inside this shop, or nowhere (storefront-branding R2c).
   *
   * The schema proves the *shape* — `/store/…` or `/product/…`. Only here can the
   * *ownership* be proved: that the handle is this org's, and that a product slug names
   * something this org actually sells. Without the second half a shop could point its
   * banner at a competitor's goods, which is the thing R2c exists to stop.
   */
  async assertHrefIsOwn(orgId: string, href: string | null | undefined) {
    const target = href?.trim();
    if (!target) return;

    const settings = await orgRepository.findStorefrontSettings(orgId);
    if (!settings) throw new NotFoundError("Organisation not found");

    const path = target.split("?")[0];
    if (path === `/store/${settings.handle}` || path.startsWith(`/store/${settings.handle}/`)) {
      return;
    }

    const slug = path.startsWith("/product/") ? path.slice("/product/".length) : null;
    if (slug) {
      const product = await productsRepository.getProductBySlug(slug);
      if (product && product.orgId === orgId) return;
    }

    throw new ConflictError(
      "A banner can only point at your own shop or one of your products."
    );
  },

  /** A handle this name would produce, for the editor's suggestion. */
  suggestHandle(name: string) {
    return handleCandidates(name).next().value as string;
  },
};
