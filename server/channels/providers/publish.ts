import type { BuiltField } from "@server/listing/field-map.types";

import type { ListingField, ListingIssue } from "../platform-listing.types";

/**
 * What a provider is handed to publish a listing and what it answers (marketplace-publish D1), one
 * shape for every marketplace. Prices are paise; a provider converts to its own unit.
 */

export interface PublishRef {
  sku: string;
  externalId: string | null;
  marketplaceType: string | null;
}

/** Only the fields that differ from what was last sent (D2); photos as public addresses, in order. */
export interface PublishChanges {
  title?: string;
  price?: number;
  photoUrls?: string[];
  features?: string[];
  description?: string;
  listed?: boolean;
  /** The product's MRP, which a marketplace may want beside a price (Flipkart's price update). */
  mrpPaise: number | null;
}

export interface PublishAnswer {
  /** The fields the marketplace took. */
  accepted: ListingField[];
  issues: ListingIssue[];
  /** True when the marketplace decides later and must be asked (Amazon); false when its answer is final. */
  decidesLater: boolean;
}

export interface StatusAnswer {
  /** False while the marketplace has no such listing yet (a create still processing). */
  found: boolean;
  live: boolean | null;
  issues: ListingIssue[];
  /** What the marketplace's page shows: its title and main photo (marketplace-publish Q14). */
  showing: { title: string | null; mainImageUrl: string | null };
}

/** A listing the marketplace says has a problem now (marketplace-publish Q23): its errors, and whether it is hidden from shoppers. */
export interface ListingProblem {
  sku: string;
  issues: ListingIssue[];
  suppressed: boolean;
}

/** A page already on the marketplace that a product could sell on (D6). */
export interface PageMatch {
  externalId: string;
  title: string;
  imageUrl: string | null;
  matchedBy: "barcode" | "name";
}

/** Everything a new listing needs (D6, D7, D8), channel-neutral. */
export interface CreateListingInput {
  sku: string;
  /** Sell on an existing page, or make a new one. */
  mode: "offer" | "new";
  targetExternalId: string | null;
  marketplaceType: string | null;
  /** A family's own page: no offer, the theme its members vary by. */
  family: { role: "parent"; theme: string } | { role: "child"; parentSku: string; theme: string } | null;
  title: string;
  price: number;
  mrpPaise: number | null;
  photoUrls: string[];
  features: string[];
  description: string;
  barcode: string | null;
  brand: string | null;
  /** The shop's brand is not registered on the marketplace: list unbranded, as it words that (setup-requests Q35). */
  generic: boolean;
  quantity: number;
  /** The listing built from the product and the field maps (listing-model/field-maps D3). */
  fields: BuiltField[];
  /** The marketplace type's stored JSON Schema, which shapes and checks the fields (field-maps D5, D6); null when unread. */
  typeSchema: unknown;
  compliance: { countryOfOrigin: string | null; manufacturer: string | null; packer: string | null; importer: string | null; hsn: string | null };
}

/** One attribute a marketplace type asks, from its published definition (setup-requests D7). */
export interface TypeAttribute {
  /** The marketplace's own name, e.g. `strap_type`. */
  name: string;
  /** How the marketplace labels it, e.g. "Strap Type". */
  label: string;
  required: boolean;
  /** The answers it allows, as it words them; empty when free text. */
  allowed: string[];
  /**
   * A group of named parts (Amazon's `inner` → material, `item_dimensions` → length, width, height) rather than
   * one answer: one of our answers cannot fill it, only a map per part (Amazon refusal, 2026-11-09).
   */
  parts?: string[];
}

/** A marketplace type's definition: what it requires and allows (setup-requests D7). */
export interface TypeDefinition {
  theirCategory: string;
  attributes: TypeAttribute[];
}

/** A marketplace type found by a search (setup-requests Q29). */
export interface TypeMatch {
  theirCategory: string;
  label: string;
}


export { FIELD_KIND, FIELD_REQUIREMENT, type CatalogueField, type CatalogueType, type FieldKind, type FieldRequirement } from "@server/listing/channel-catalogue.types";
