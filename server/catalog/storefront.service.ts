/**
 * What an org may change about its own shop (org-storefront/storefront-branding).
 *
 * Two operations that look alike and are not: composing a storefront is an ordinary
 * edit, while changing a handle moves a public address and is its own authorised act
 * with its own consequences (ADR-0030 decision 4). Keeping them apart here is what
 * stops a handle riding along in an update payload.
 */

import { toInternalPath } from "@server/shared/internal-href";
import { orgRepository } from "@server/catalog/org.repository";
import { orgProfileRepository } from "@server/catalog/org-profile.repository";
import {
  orgBannerRepository,
  type OrgBannerInput,
} from "@server/catalog/org-banner.repository";
import { productsRepository } from "@server/catalog/product.read.repository";
import { brandService } from "@server/catalog/brand.service";
import { reviewService } from "@server/catalog/review.service";
import { orderService } from "@server/checkout/order.service";
import {
  BUYERS_SAY_COUNT,
  buyersSayFrom,
  proofFrom,
} from "@server/catalog/brand-page-proof";
import { toBrandPageDto, type BrandPageDto } from "@server/catalog/storefront.types";
import { Prisma } from "@prisma/client";
import type { BrandPillar, HideableBrandPageSection } from "@server/catalog/brand-page-sections";
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

/** Looks only since org-profile U2 (D3): the facts are Shop details', so two editors never share a column. */
export interface StorefrontSettingsInput {
  heroUrl?: string | null;
  accent?: string | null;
  pillars?: BrandPillar[] | null;
  hiddenSections?: HideableBrandPageSection[] | null;
}

export interface BannerInput {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  href?: string | null;
  isActive?: boolean;
}

/** Empty strings from a form mean "cleared", not "set to nothing". */
const orNull = (value: string | null | undefined) => value?.trim() || null;

/**
 * A JSON column has two kinds of nothing. `null` tells Prisma to leave the column as it is,
 * which is what an update means everywhere else in the client, so clearing one needs
 * `JsonNull` — otherwise a shop that removes its last handle keeps showing the old ones.
 */
const jsonOrNull = (value: unknown) =>
  value === null || value === undefined
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);

/** The editor shows three slots; an untouched one is not a block. Both halves or neither
 * is the schema's rule, so anything arriving here with one half is already refused. */
function pillarsKept(pillars: { title: string; text: string }[] | null | undefined) {
  if (!pillars) return null;
  const kept = pillars.filter((pillar) => pillar.title.trim() !== "" && pillar.text.trim() !== "");
  return kept.length ? kept : null;
}

/** Whitelisted field by field — the payload is never spread into a write. */
function normaliseBanner(input: BannerInput): OrgBannerInput {
  return {
    title: orNull(input.title),
    description: orNull(input.description),
    imageUrl: orNull(input.imageUrl),
    imageAlt: orNull(input.imageAlt),
    href: orNull(input.href),
    isActive: input.isActive ?? true,
  };
}

/** How many numbered variants a taken link is checked against for a suggestion. */
const LINK_SUGGESTIONS = 5;

/** ux Refused: "That link is taken. Try {suggestion}." — the suggestion only when one is free. */
async function linkTaken(handle: string): Promise<ConflictError> {
  const candidates: string[] = [];
  const each = handleCandidates(handle);
  each.next(); // the taken one itself
  while (candidates.length < LINK_SUGGESTIONS) candidates.push(each.next().value as string);
  const free = await orgRepository.firstFreeHandle(candidates, holdCutoff());
  return new ConflictError(free ? `That link is taken. Try ${free}.` : "That link is taken.", { field: "handle" });
}

export const storefrontService = {
  /**
   * The brand page of the shop at this handle, or null (brand-page D1).
   *
   * Built from the profile's public read and the brand aggregate's names, in this domain,
   * plus the proof other surfaces derive (D2): the reviews service's org aggregate and newest
   * published reviews, and checkout's paid-order count — each asked of a service, never a
   * repository (ADR-0033), and each cut off at its floor here (D3). The goods and category
   * tiles are not here: a product as a buyer sees it is priced in
   * `src/data-access-layer/products.dal.ts` (ADR-0018), and pricing it twice is what spec
   * R6 forbids, so the data-access layer adds those two slices beside this one.
   */
  async brandPage(handle: string): Promise<BrandPageDto | null> {
    const profile = await orgProfileRepository.findPublicByHandle(handle);
    if (!profile) return null;
    const orgId = profile.org.id;
    const [brands, rating, recent, paidOrders] = await Promise.all([
      brandService.list(orgId),
      reviewService.ratingForOrg(orgId),
      reviewService.recentForOrg(orgId, BUYERS_SAY_COUNT),
      orderService.paidOrderCountForOrg(orgId),
    ]);
    return toBrandPageDto(profile, brands, {
      proof: proofFrom({
        ratingAverage: rating.average,
        ratingCount: rating.count,
        paidOrders,
      }),
      buyersSay: buyersSayFrom(recent, rating.count),
    });
  },

  /** This org's storefront as it stands, for its own editor. */
  async getSettings(orgId: string) {
    const settings = await orgProfileRepository.findSettings(orgId);
    if (!settings) throw new NotFoundError("Organisation not found");
    return settings;
  },

  /**
   * Save the shop's looks. Whitelisted by name, and a field not sent is left as it is, so this
   * save can never clear a column Shop details owns (org-profile D3, Q17).
   */
  async saveSettings(orgId: string, input: StorefrontSettingsInput) {
    await orgProfileRepository.updateLooks(orgId, {
      ...(input.heroUrl !== undefined && { heroUrl: orNull(input.heroUrl) }),
      ...(input.accent !== undefined && { accent: orNull(input.accent) }),
      // JSON is cleared with `JsonNull`; `null` is Prisma's "leave this alone".
      ...(input.pillars !== undefined && { pillars: jsonOrNull(pillarsKept(input.pillars)) }),
      ...(input.hiddenSections !== undefined && {
        hiddenSections: jsonOrNull(input.hiddenSections?.length ? input.hiddenSections : null),
      }),
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
    const settings = await orgProfileRepository.findSettings(orgId);
    if (!settings) throw new NotFoundError("Organisation not found");

    const next = requested.trim().toLowerCase();
    if (!isValidSlug(next)) {
      throw new DomainError(
        "A handle can use lowercase letters, numbers and hyphens only.",
        { status: 400, field: "handle" },
      );
    }
    if (isReservedHandle(next)) {
      throw new ConflictError("That address is reserved by the platform.", {
        field: "handle",
      });
    }
    if (next === settings.handle) {
      throw new ConflictError("That is already this shop's address.", {
        field: "handle",
      });
    }
    if (await orgRepository.isHandleHeldByAnother(next, orgId, holdCutoff())) {
      // Held, not free: another shop left it recently and can still take it back.
      throw await linkTaken(next);
    }

    try {
      return await orgRepository.changeHandle(orgId, settings.handle, next);
    } catch (error) {
      if (isUniqueViolation(error, "handle")) throw await linkTaken(next);
      throw error;
    }
  },

  /** This org's banners, live and taken down, for its own editor. */
  async listBanners(orgId: string) {
    return await orgBannerRepository.listForOrg(orgId);
  },

  async addBanner(orgId: string, input: BannerInput) {
    const href = await this.resolveOwnHref(orgId, input.href);
    return await orgBannerRepository.create(
      orgId,
      normaliseBanner({ ...input, href }),
    );
  },

  async editBanner(orgId: string, id: string, input: BannerInput) {
    const href = await this.resolveOwnHref(orgId, input.href);
    const updated = await orgBannerRepository.update(
      orgId,
      id,
      normaliseBanner({ ...input, href }),
    );
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
   * Reduce a destination to a path this shop owns, or refuse it
   * (storefront-branding R2c).
   *
   * An org pastes what is in its address bar, so `href` usually arrives absolute. The
   * stored value is always the **path**: an absolute one carries the origin it was
   * copied from, and `http://localhost:3000/store/…` is a link that works on one
   * machine and nowhere else. Normalising here rather than at the call site means the
   * column cannot hold both shapes.
   *
   * The regex proves the shape; this proves the ownership — that the handle is this
   * org's, and that a product slug names something it actually sells. Without the
   * second half a shop could point its promotion at a competitor's goods.
   */
  async resolveOwnHref(
    orgId: string,
    href: string | null | undefined,
  ): Promise<string | null> {
    const raw = href?.trim();
    if (!raw) return null;

    const settings = await orgProfileRepository.findSettings(orgId);
    if (!settings) throw new NotFoundError("Organisation not found");

    const refuse = () => {
      throw new ConflictError(
        "A promotion can only point at your own shop or one of your own products.",
        // Fixable by editing the box, so it belongs on the box (ADR-0013).
        { field: "href" },
      );
    };

    // One rule for what counts as our own site, shared with the platform's banners
    // (`internal-href.ts`): a full URL pasted from the address bar is reduced to its
    // path, and anything pointing elsewhere is refused rather than quietly rewritten.
    const target = toInternalPath(raw);
    if (!target) refuse();

    const path = target!.split("?")[0];
    const ownShop =
      path === `/store/${settings.handle}` ||
      path.startsWith(`/store/${settings.handle}/`);

    if (!ownShop) {
      const slug = path.startsWith("/product/")
        ? path.slice("/product/".length)
        : null;
      const product = slug
        ? await productsRepository.getProductBySlug(slug)
        : null;
      if (!product || product.orgId !== orgId) refuse();
    }

    return target;
  },

  /** A handle this name would produce, for the editor's suggestion. */
  suggestHandle(name: string) {
    return handleCandidates(name).next().value as string;
  },
};
