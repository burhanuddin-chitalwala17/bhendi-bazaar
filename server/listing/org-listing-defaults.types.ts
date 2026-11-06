import type { OrgListingDefaults } from "@prisma/client";

/**
 * The org-wide listing defaults the portal edits (org-profile spec R4, trd D1). The wire talks
 * percent and a list; the column holds basis points and a JSON map keyed by category id, so a
 * rounding rule lives here once rather than in every reader.
 */
export interface TaxCodeEntry {
  categoryId: string;
  taxCode: string;
}

export interface OrgListingDefaultsDto {
  countryOfOrigin: string | null;
  taxRatePercent: number | null;
  taxCodes: TaxCodeEntry[];
  /** The shop's brand is not on Amazon, so it lists there as Generic (setup-requests Q35). */
  amazonGeneric: boolean;
}

export interface ListingDefaultsInput {
  countryOfOrigin: string | null;
  taxRatePercent?: number | undefined;
  taxCodes: TaxCodeEntry[];
}

export const EMPTY_LISTING_DEFAULTS: OrgListingDefaultsDto = {
  countryOfOrigin: null,
  taxRatePercent: null,
  taxCodes: [],
  amazonGeneric: false,
};

/** Basis points keep two decimals of a percent without a float in the column (Invariant 3's habit). */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/** The stored map, read defensively: a non-object or a non-string value reads as no code. */
export function taxCodesFromColumn(value: unknown): TaxCodeEntry[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "")
    .map(([categoryId, taxCode]) => ({ categoryId, taxCode }));
}

/** Blank codes are dropped rather than stored, so clearing a field is the same as never filling it. */
export function taxCodesToColumn(entries: TaxCodeEntry[]): Record<string, string> {
  return Object.fromEntries(
    entries.filter((entry) => entry.taxCode.trim() !== "").map((entry) => [entry.categoryId, entry.taxCode.trim()]),
  );
}

export function toListingDefaultsDto(row: OrgListingDefaults | null): OrgListingDefaultsDto {
  if (!row) return EMPTY_LISTING_DEFAULTS;
  return {
    countryOfOrigin: row.countryOfOrigin,
    taxRatePercent: row.taxRateBps === null ? null : bpsToPercent(row.taxRateBps),
    taxCodes: taxCodesFromColumn(row.taxCodeByCategory),
    amazonGeneric: row.amazonGeneric,
  };
}
