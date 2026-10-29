import type { ListingStatus, MarketplaceChannel } from "./channel-connection.types";
import type { MarketplaceQuestionDTO, SettleTypeDTO } from "./channel-facts.types";

/** Members one family page settles at a time (family-merge Q19). */
export const FAMILY_MAX_MEMBERS = 30;

/** A member's value on one axis, as the shop reads it. */
export interface FamilyValueDTO {
  /** Our answer's key, or a number for a measurement. */
  value: string | number | boolean;
  display: string;
  from: "listing" | "answer" | "existing";
}

/** One type's plan for the page's members (family-merge D1), so a category choice shows at once. */
export interface FamilyTypePlanDTO {
  label: string;
  /** `unit` for a measurement: it is answered with a number (Q18). */
  axes: Array<{ key: string; label: string; added: boolean; unit?: string }>;
  members: Array<{ listingId: string; values: Record<string, FamilyValueDTO>; questions: MarketplaceQuestionDTO[] }>;
  shared: Array<{ fact: string; label: string; value: string }>;
  sharedQuestions: MarketplaceQuestionDTO[];
  duplicates: Array<[string, string]>;
}

export interface FamilyMemberDTO {
  listingId: string;
  sku: string;
  externalId: string | null;
  title: string | null;
  imageUrl: string | null;
  status: ListingStatus | null;
  live: boolean;
  pricePaise: number | null;
  quantity: number | null;
  readFailed: boolean;
  /** Already a product here: it joins as it is (Q4, D3). */
  product: {
    id: string;
    name: string;
    sku: string | null;
    pricePaise: number;
    archived: boolean;
    /** In another family: moved only when the owner says so (Q11). */
    family: { id: string; name: string } | null;
  } | null;
}

/** The family page (family-merge ux.md "Family page"). */
export interface FamilyPageDTO {
  channel: MarketplaceChannel;
  label: string;
  /** The family being added to (Q20), or null for a new one. */
  family: { id: string; name: string; productType: string | null; memberCount: number; members: string[] } | null;
  name: string;
  description: string;
  members: FamilyMemberDTO[];
  /** Listings beyond the page's limit, added afterwards with Add to family (Q19). */
  more: number;
  type: SettleTypeDTO | null;
  defaultCategoryId: string | null;
  typeOfCategory: Record<string, string>;
  byType: Record<string, FamilyTypePlanDTO>;
  locations: Array<{ id: string; name: string }>;
}

/** A family save as the channels domain takes it, after the route has parsed it (family-merge D3). */
export interface FamilySettleInput {
  listingIds: string[];
  familyId?: string;
  name: string;
  description: string;
  categoryId?: string;
  removedAxes: string[];
  /** Member answers keyed by listing id, and the family's shared answers under "*". */
  answers: Record<string, Record<string, string>>;
  members: Array<{
    listingId: string;
    include: boolean;
    /** Leave a product's other family for this one (Q11). */
    move: boolean;
    sku?: string;
    pricePaise?: number;
    stock: Array<{ locationId: string; quantity: number }>;
  }>;
}

export interface FamilySettleResultDTO {
  familyId: string;
  familyName: string;
  members: number;
  axisWord: string;
}
