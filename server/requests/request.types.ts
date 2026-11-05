import type { Channel } from "@server/shared/channels";

/** Requirement: the admin enables it. Issue: a developer fixes it (setup-requests Q21). */
export const TICKET_TYPE = { REQUIREMENT: "requirement", ISSUE: "issue" } as const;
export type TicketType = (typeof TICKET_TYPE)[keyof typeof TICKET_TYPE];

/** Each kind is one plug-in in `kinds/` (D4); a new kind is a file and a line here. */
export const TICKET_KIND = {
  AMAZON_FIELDS: "amazon-fields",
  AMAZON_CATEGORY: "amazon-category",
  ISSUE: "issue",
} as const;
export type TicketKind = (typeof TICKET_KIND)[keyof typeof TICKET_KIND];

export const TICKET_STATUS = { OPEN: "open", DONE: "done", CLOSED: "closed" } as const;
export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

export const CLOSED_REASON = { NOT_NOW: "not_now", NOT_NEEDED: "not_needed" } as const;
export type ClosedReason = (typeof CLOSED_REASON)[keyof typeof CLOSED_REASON];

/** An issue's category (Q23). */
export const ISSUE_CATEGORY = {
  LISTING: "listing",
  STOCK: "stock",
  ORDERS: "orders",
  OTHER: "other",
} as const;
export type IssueCategory = (typeof ISSUE_CATEGORY)[keyof typeof ISSUE_CATEGORY];
export const ISSUE_CATEGORIES = Object.values(ISSUE_CATEGORY) as readonly IssueCategory[];

/** What the shop reads, one word per state (Q31). */
export const SHOP_STATE = { WITH_US: "with_us", READY: "ready", NOT_SUPPORTED: "not_supported" } as const;
export type ShopState = (typeof SHOP_STATE)[keyof typeof SHOP_STATE];

/** A ticket's subject per kind: what fixes it, never who needs it (Q3). */
export type TicketSubject =
  | { kind: typeof TICKET_KIND.AMAZON_FIELDS; channel: Channel; theirCategory: string; attributes: string[] }
  | { kind: typeof TICKET_KIND.AMAZON_CATEGORY; channel: Channel; productType: string; productKind: string | null }
  | { kind: typeof TICKET_KIND.ISSUE; channel: Channel | null; theirCategory: string | null; attribute: string | null; code: string | null; message: string | null };

/** One shop's need, as a caller hands it to `raise` (D5). */
export interface NeedInput {
  orgId: string;
  productId: string | null;
  subject: TicketSubject;
  /** The marketplace's complaint as received; kept for the issue view and the shop's own line. */
  detail?: { code: string | null; attribute: string | null; message: string } | null;
}

/** A report the shop writes (Q7, Q24): an issue, with or without an error attached. */
export interface ReportInput {
  orgId: string;
  productId: string | null;
  category: IssueCategory;
  words: string;
  error: { channel: Channel; theirCategory: string | null; attribute: string | null; code: string | null; message: string } | null;
}

/** The shop's view of one ticket: what it needs and where it stands, never the steps (Q3, D11). */
export interface ShopTicketDTO {
  id: string;
  type: TicketType;
  kind: TicketKind;
  state: ShopState;
  /** "Amazon details for Tote bag", or the marketplace an issue concerns. */
  title: string;
  /** An issue's category, which the shop's screen words (Q23); null for a requirement. */
  category: IssueCategory | null;
  /** For a fields ticket, the names the shop will fill once ready. */
  names: string[];
  productId: string | null;
  raisedAt: string;
}

/** A requirement in the admin's inbox: the setup and how many wait, never which shops (Q3, Q4, D11). */
export interface AdminRequirementDTO {
  id: string;
  kind: TicketKind;
  status: TicketStatus;
  title: string;
  /** null when one shop waits (Q4). */
  shopsWaiting: number | null;
  reopened: boolean;
  openedAt: string;
}

/** An issue: the developer sees each shop's report (Q22, Q26). */
export interface AdminIssueDTO {
  id: string;
  status: TicketStatus;
  title: string;
  error: { channel: Channel | null; theirCategory: string | null; attribute: string | null; code: string | null; message: string | null };
  reports: Array<{ shop: string; productName: string | null; category: IssueCategory | null; words: string | null; at: string }>;
  reopened: boolean;
  openedAt: string;
}

/** How one field is solved (D6, Q32). */
export const FIELD_SOLUTION = {
  REUSE: "reuse",
  ADD: "add",
  FROM_PRODUCT: "from_product",
  FIXED: "fixed",
  NOT_POSSIBLE: "not_possible",
} as const;
export type FieldSolution = (typeof FIELD_SOLUTION)[keyof typeof FIELD_SOLUTION];

/** The plan the admin previews and Apply writes (D7). `hash` refuses a stale Apply. */
export type RequirementPlanDTO =
  | {
      kind: typeof TICKET_KIND.AMAZON_FIELDS;
      theirCategory: string;
      productTypes: Array<{ key: string; label: string }>;
      fields: Array<{
        attribute: string;
        label: string;
        solution: FieldSolution;
        /** The fact reused or added, for reuse and add. */
        fact: string | null;
        factLabel: string | null;
        /** For from_product: sku, name or brand. For fixed: the value. */
        source: string | null;
        constant: string | null;
        /** Amazon's allowed answers, for showing; values our list lacks are added under Amazon's wording. */
        allowed: string[];
        required: boolean;
      }>;
      readAt: string;
      hash: string;
    }
  | {
      kind: typeof TICKET_KIND.AMAZON_CATEGORY;
      productType: string;
      productTypeLabel: string;
      options: Array<{ theirCategory: string; label: string; exact: boolean }>;
      readAt: string;
      hash: string;
    };

/** Why a plan could not be read (ux "not connected", "Amazon busy"): channels' own closed set. */
export { TYPES_UNAVAILABLE as PLAN_UNAVAILABLE, type TypesUnavailable as PlanUnavailable } from "@server/channels/channel-connection.types";

/** What the admin picks before Apply, for a decision kind or a renamed field (Q6, Q15). */
export interface ApplyChoice {
  hash: string;
  theirCategory?: string;
  fields?: Array<{ attribute: string; solution: FieldSolution; fact?: string | null; source?: string | null; constant?: string | null }>;
}
