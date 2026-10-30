import { Prisma } from "@prisma/client";

import { orgProfileRepository, type ShopDetailsSectionData } from "@server/catalog/org-profile.repository";
import { aboutOf } from "@server/catalog/storefront.types";
import {
  SHOP_DETAILS_SECTION,
  type ShopDetailsDto,
  type ShopDetailsSave,
} from "@server/catalog/shop-details.types";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";

/** Empty strings from a form mean "cleared". */
const orNull = (value: string | null | undefined) => value?.trim() || null;

/** Blank means "remove this network", so an empty handle never reaches the column. */
function handlesKept(social: Record<string, string> | null | undefined) {
  const kept = Object.entries(social ?? {}).filter(([, handle]) => handle.trim() !== "");
  return kept.length ? Object.fromEntries(kept) : null;
}

/** "Someone changed this 2 min ago. Load their version?" — the ux Stale copy. */
export function staleMessage(savedAt: Date, now = new Date()): string {
  const minutes = Math.max(1, Math.round((now.getTime() - savedAt.getTime()) / 60_000));
  return `Someone changed this ${minutes} min ago. Load their version?`;
}

/**
 * Whitelisted per section (Invariant 4, D3): each branch names its own columns and no others, so
 * a save of one section can never clear another (Q17).
 */
function columnsFor(input: ShopDetailsSave, now: Date): ShopDetailsSectionData {
  switch (input.section) {
    case SHOP_DETAILS_SECTION.ESSENTIALS:
      return { tagline: orNull(input.tagline), logoUrl: orNull(input.logoUrl) };
    case SHOP_DETAILS_SECTION.ABOUT:
      // The joined text becomes the one about; `story` is kept as the undo, never shown again (Q18).
      return { description: orNull(input.about), storyMergedAt: now };
    case SHOP_DETAILS_SECTION.PLACE:
      return { location: orNull(input.location) };
    case SHOP_DETAILS_SECTION.PERSON:
      return {
        ownerName: orNull(input.ownerName),
        ownerRole: orNull(input.ownerRole),
        ownerQuote: orNull(input.ownerQuote),
        ownerPhotoUrl: orNull(input.ownerPhotoUrl),
      };
    case SHOP_DETAILS_SECTION.SOCIAL: {
      const kept = handlesKept(input.social);
      // `null` is Prisma's "leave alone" for JSON; clearing needs `JsonNull`.
      return { social: kept ?? Prisma.JsonNull };
    }
    case SHOP_DETAILS_SECTION.PROMISE:
      return { returnsPreset: input.returnsPreset, promiseNote: orNull(input.promiseNote) };
  }
}

function socialOf(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export const shopDetailsService = {
  async get(orgId: string): Promise<ShopDetailsDto> {
    const row = await orgProfileRepository.findShopDetails(orgId);
    if (!row) throw new NotFoundError("Organisation not found");
    const about = aboutOf(row);
    return {
      handle: row.org.handle,
      name: row.org.name,
      updatedAt: row.updatedAt.toISOString(),
      tagline: row.tagline,
      logoUrl: row.logoUrl,
      about,
      aboutJoined: !row.storyMergedAt && Boolean(row.story?.trim()) && Boolean(row.description?.trim()),
      location: row.location,
      social: socialOf(row.social),
      ownerName: row.ownerName,
      ownerRole: row.ownerRole,
      ownerQuote: row.ownerQuote,
      ownerPhotoUrl: row.ownerPhotoUrl,
      returnsPreset: row.returnsPreset,
      promiseNote: row.promiseNote,
      oldDeliveryPolicy: row.deliveryPolicy?.trim() || null,
      oldReturnsPolicy: row.returnsPolicy?.trim() || null,
    };
  },

  /** One section, conditional on the version the page read (Q21). A miss is the Stale state. */
  async saveSection(orgId: string, input: ShopDetailsSave): Promise<ShopDetailsDto> {
    const now = new Date();
    const saved = await orgProfileRepository.updateSectionIfUnchanged(
      orgId,
      new Date(input.expectedUpdatedAt),
      columnsFor(input, now),
    );
    if (!saved) {
      const current = await orgProfileRepository.findUpdatedAt(orgId);
      if (!current) throw new NotFoundError("Organisation not found");
      throw new ConflictError(staleMessage(current, now));
    }
    return await this.get(orgId);
  },
};
