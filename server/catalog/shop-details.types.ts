import type { ReturnsPreset } from "@prisma/client";

export type { ReturnsPreset };

/**
 * Shop details: the shop's facts as it edits them, one section at a time (org-profile D2, D3).
 * No code, GST, PAN or business name — those are not this page's (R6, R8).
 */

/** Q7's three promises, typed against the Prisma enum so a value added or renamed there fails to compile. */
export const RETURNS_PRESET = {
  STANDARD: "STANDARD",
  EXCHANGE_7_DAY: "EXCHANGE_7_DAY",
  NO_RETURNS: "NO_RETURNS",
} as const satisfies { [K in ReturnsPreset]: K };
export const RETURNS_PRESETS = Object.values(RETURNS_PRESET) as [ReturnsPreset, ...ReturnsPreset[]];

/** What a buyer reads for each promise (Q7). */
export const RETURNS_PRESET_LABEL: Record<ReturnsPreset, string> = {
  [RETURNS_PRESET.STANDARD]: "Bhendi Bazaar's standard returns",
  [RETURNS_PRESET.EXCHANGE_7_DAY]: "7-day exchange only",
  [RETURNS_PRESET.NO_RETURNS]: "No returns on this shop",
};

/** The sections a save names (D3). Each writes only its own columns. */
export const SHOP_DETAILS_SECTION = {
  ESSENTIALS: "essentials",
  ABOUT: "about",
  PLACE: "place",
  PERSON: "person",
  SOCIAL: "social",
  PROMISE: "promise",
} as const;
export type ShopDetailsSection = (typeof SHOP_DETAILS_SECTION)[keyof typeof SHOP_DETAILS_SECTION];

/** Q11: the most "About your shop" may hold, and where the counter starts (ux Long content). */
export const ABOUT_MAX = 4000;
export const ABOUT_COUNTER_FROM = 3600;
export const PROMISE_NOTE_MAX = 280;

/** ux Refused: name, mobile, email and link are the owner's to change (Q23). */
export const SHOP_OWNER_ONLY = "Only the shop owner can change this.";

export interface ShopDetailsDto {
  handle: string;
  name: string;
  /** The version this page read; every save carries it back (Q21). */
  updatedAt: string;
  /** Only Bhendi Bazaar sees these (D7, Q8). Null for a shop opened before the mobile was asked. */
  phone: string | null;
  email: string;
  /** The org's own version, which a name, mobile or email save carries back (D7, Q21). */
  contactUpdatedAt: string;
  tagline: string | null;
  logoUrl: string | null;
  /** `aboutOf` — what buyers read now, and what the box opens with. */
  about: string | null;
  /** True while the box holds the introduction and the longer story joined, not yet saved (D4). */
  aboutJoined: boolean;
  location: string | null;
  social: Record<string, string>;
  ownerName: string | null;
  ownerRole: string | null;
  ownerQuote: string | null;
  ownerPhotoUrl: string | null;
  returnsPreset: ReturnsPreset;
  promiseNote: string | null;
  /** The free text buyers no longer see, shown to the shop read-only (Q19). */
  oldDeliveryPolicy: string | null;
  oldReturnsPolicy: string | null;
}

/** One section's save as the service takes it; the route's schema is what produced it (D3). */
type Version = { expectedUpdatedAt: string };
export type ShopDetailsSave = Version &
  (
    | { section: typeof SHOP_DETAILS_SECTION.ESSENTIALS; tagline?: string | null; logoUrl?: string | null }
    | { section: typeof SHOP_DETAILS_SECTION.ABOUT; about?: string | null }
    | { section: typeof SHOP_DETAILS_SECTION.PLACE; location?: string | null }
    | {
        section: typeof SHOP_DETAILS_SECTION.PERSON;
        ownerName?: string | null;
        ownerRole?: string | null;
        ownerQuote?: string | null;
        ownerPhotoUrl?: string | null;
      }
    | { section: typeof SHOP_DETAILS_SECTION.SOCIAL; social?: Record<string, string> | null }
    | { section: typeof SHOP_DETAILS_SECTION.PROMISE; returnsPreset: ReturnsPreset; promiseNote?: string | null }
  );

/** A name, mobile or email save as the service takes it; any of the three, only what changed (D7). */
export interface ShopContactSave {
  name?: string;
  phone?: string;
  email?: string;
  expectedUpdatedAt: string;
}
