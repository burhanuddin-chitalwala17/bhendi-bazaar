import type { MarketplaceChannel } from "./channel-connection.types";

/** What a "Facts from {marketplace}" card says (marketplace-facts ux.md, state matrix). */
export const FACTS_STATE = {
  NOT_READ: "not_read",
  RECONNECT: "reconnect",
  /** The product has no type and the marketplace's type says nothing we can use. */
  NO_TYPE: "no_type",
  NO_MAPPING: "no_mapping",
  NO_ANSWERS: "no_answers",
  TYPE_TO_CONFIRM: "type_to_confirm",
  CATEGORY_TO_CONFIRM: "category_to_confirm",
  NO_MATCHING_TYPE: "no_matching_type",
  READY: "ready",
} as const;
export type FactsState = (typeof FACTS_STATE)[keyof typeof FACTS_STATE];

export interface MarketplaceFactRowDTO {
  fact: string;
  column: "facts" | "measurements";
  label: string;
  /** Our answer as the shop reads it: a list answer's label, a number with its unit. */
  value: string;
  /** The marketplace's own words. */
  said: string;
  chosen: boolean;
  /** The shop changed it after it was filled: "changed by you (was Crepe from Amazon)". */
  changed: boolean;
  /** Our answers, for "Change" on a list fact; empty for any other fact. */
  options: Array<{ key: string; label: string }>;
}

export interface MarketplaceQuestionDTO {
  fact: string;
  label: string;
  said: string;
  options: Array<{ key: string; label: string }>;
}

export interface TypeChoiceDTO {
  key: string;
  label: string;
  categories: Array<{ id: string; name: string }>;
}

/** One card per linked marketplace listing (Q4, Q14), the same for every marketplace. */
export interface ProductMarketplaceFactsDTO {
  listingId: string;
  channel: MarketplaceChannel;
  label: string;
  /** For the message to the admin (Q13). */
  sku: string;
  title: string | null;
  state: FactsState;
  readAt: string | null;
  /** The marketplace's own name for its type, as read. */
  marketplaceType: string | null;
  filled: MarketplaceFactRowDTO[];
  questions: MarketplaceQuestionDTO[];
  /** Questions the shop skipped for now; each can be asked again (D6). */
  skipped: Array<{ fact: string; label: string }>;
  /** Set when a mapping row the card used was checked over 90 days ago (Q8). */
  staleCheckedOn: string | null;
  /** The types to pick from: the mapped one, the several, or all of ours (Q11, Q25). */
  types: TypeChoiceDTO[];
}

/** What the Settle page asks about a new product's type (Q9, Q11, Q25, Q6): from the marketplace's own type. */
export interface SettleTypeDTO {
  kind: "mapped" | "choose" | "none";
  marketplaceType: string;
  types: TypeChoiceDTO[];
}

/** One type's facts from the listing, as the Settle page shows them once that type's category is chosen (Q35). */
export interface SettleTypeFactsDTO {
  fills: Array<{ fact: string; label: string; value: string }>;
  questions: MarketplaceQuestionDTO[];
  noMapping: boolean;
}

/** The Settle page's facts for every type, so choosing a category shows its facts at once (Q35). */
export interface SettleFactsDTO {
  /** Each category's type key; a category with none is absent. */
  typeOfCategory: Record<string, string>;
  byType: Record<string, SettleTypeFactsDTO>;
  /** Matching keeps the product's own type. */
  fixedType: string | null;
  saysNothing: boolean;
}

/** What a "Fill from" tap answers; the card's copy is chosen by the outcome. */
export type FillNowOutcome = "filled" | "busy" | "reconnect" | "not_linked";

/** The card's commands on one listing (marketplace-facts D8), as the route has parsed them. */
export type MarketplaceFactsChange =
  | { action: "fill" }
  | { action: "answer" | "change"; fact: string; value: string }
  | { action: "reset"; fact: string }
  | { action: "skip"; fact: string; skipped: boolean }
  | { action: "category"; categoryId: string };
