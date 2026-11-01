/**
 * The brand page's sections, named once (brand-page R1, R7).
 *
 * Three places need this vocabulary and must agree: the schema that accepts a shop's choice
 * of what to hide, the page that renders the sections in order, and the panel that tells a
 * shop what its page currently shows. Declared here, in the domain that owns the profile, so
 * none of the three spells a key of its own.
 */

/** The one order the platform sets. The proof strip is part of the hero, not a section (R3). */
export const BRAND_PAGE_SECTION_ORDER = [
  "hero",
  "story",
  "categories",
  "brands",
  "buyersSay",
  "newest",
  "policies",
  "social",
] as const;

export type BrandPageSection = (typeof BRAND_PAGE_SECTION_ORDER)[number];

/**
 * What a shop may hide: the sections it writes itself.
 *
 * R7 lets a shop hide "any optional section", and the line drawn here is between what the
 * shop asserts and what others established. A shop may withhold its own story, brands,
 * terms and handles. It may not hide what buyers said, how many orders it has
 * filled, or the goods themselves — proof is derived and never typed (R4), and a page whose
 * reviews disappear when they turn unflattering is not proof at all. Hero and newest are
 * what make the page a shop rather than a leaflet, so neither is optional either.
 */
export const HIDEABLE_BRAND_PAGE_SECTIONS = [
  "story",
  "brands",
  "policies",
  "social",
] as const satisfies ReadonlyArray<BrandPageSection>;

export type HideableBrandPageSection = (typeof HIDEABLE_BRAND_PAGE_SECTIONS)[number];

/**
 * A real person behind the shop (R5). Invited, never required — a shop with none of this
 * shows its story alone, and the section says nothing about what is missing.
 */
export interface BrandOwner {
  name: string;
  role: string | null;
  quote: string | null;
  photoUrl: string | null;
}

function isHideable(value: unknown): value is HideableBrandPageSection {
  return (
    typeof value === "string" &&
    (HIDEABLE_BRAND_PAGE_SECTIONS as readonly string[]).includes(value)
  );
}

/**
 * The stored column is JSON, so it is whatever was last written there — including from an
 * older shape of this list. Anything unrecognised is dropped rather than carried: a key no
 * section answers to would hide nothing and read, in the panel, as a section that does not
 * exist.
 */
export function hiddenSectionsFrom(value: unknown): HideableBrandPageSection[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isHideable))];
}

/**
 * A face with no name is not an introduction, so the name is what the block hangs on. A role,
 * a photograph or a line without one are kept in the column and simply not shown — the shop
 * has begun filling it in, and the panel says which fact is still missing.
 */
export function brandOwnerFrom(row: {
  ownerName: string | null;
  ownerRole: string | null;
  ownerQuote: string | null;
  ownerPhotoUrl: string | null;
}): BrandOwner | null {
  const name = row.ownerName?.trim();
  if (!name) return null;
  return {
    name,
    role: row.ownerRole?.trim() || null,
    quote: row.ownerQuote?.trim() || null,
    photoUrl: row.ownerPhotoUrl || null,
  };
}
