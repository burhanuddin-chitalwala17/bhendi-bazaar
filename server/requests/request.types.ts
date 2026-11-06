/**
 * The ticket engine's own words (setup-requests D4): nothing here names a marketplace, a module or a
 * kind. A kind brings its own subject, plan and choice shapes; the engine carries them unread.
 * `tests/unit/requests-decoupled.test.ts` holds that line.
 */

/** Requirement: the admin enables it. Issue: a developer fixes it (setup-requests Q21). */
export const TICKET_TYPE = { REQUIREMENT: "requirement", ISSUE: "issue" } as const;
export type TicketType = (typeof TICKET_TYPE)[keyof typeof TICKET_TYPE];

/** A kind's name, declared by the kind itself (`kinds/`, or a plug-in folder such as `marketplace/`). */
export type TicketKind = string;

export const TICKET_STATUS = { OPEN: "open", DONE: "done", CLOSED: "closed" } as const;
export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

export const CLOSED_REASON = { NOT_NOW: "not_now", NOT_NEEDED: "not_needed" } as const;
export type ClosedReason = (typeof CLOSED_REASON)[keyof typeof CLOSED_REASON];

/** An issue's category: the shop's areas, never one module's (Q23, Q34). */
export const ISSUE_CATEGORY = {
  LISTING: "listing",
  STOCK: "stock",
  ORDERS: "orders",
  PRODUCTS: "products",
  SHOP: "shop",
  PAYMENTS: "payments",
  OTHER: "other",
} as const;
export type IssueCategory = (typeof ISSUE_CATEGORY)[keyof typeof ISSUE_CATEGORY];
export const ISSUE_CATEGORIES = Object.values(ISSUE_CATEGORY) as readonly IssueCategory[];

/** What the shop reads, one word per state (Q31). */
export const SHOP_STATE = { WITH_US: "with_us", READY: "ready", NOT_SUPPORTED: "not_supported" } as const;
export type ShopState = (typeof SHOP_STATE)[keyof typeof SHOP_STATE];

/** What fixes a ticket, in its kind's own shape; never who needs it (Q3). Every subject names its kind. */
export interface TicketSubject {
  kind: TicketKind;
  [field: string]: unknown;
}

/** What went wrong, as its source said it. Any module's: a marketplace's refusal, a gateway's, a shop's report. */
export interface NeedDetail {
  /** Where it came from (a marketplace's name, a module); null for a report from scratch. */
  source: string | null;
  /** The setting it was raised under, e.g. a marketplace type; null when none. */
  context: string | null;
  code: string | null;
  /** The thing it names (a field, a setting), if any. */
  subject: string | null;
  message: string;
}

/** One shop's need, as a kind or the engine hands it to `raise` (D5). */
export interface NeedInput {
  orgId: string;
  productId: string | null;
  subject: TicketSubject;
  detail?: NeedDetail | null;
}

/** A report the shop writes (Q7, Q24): an issue, with or without an error attached. */
export interface ReportInput {
  orgId: string;
  productId: string | null;
  category: IssueCategory;
  words: string;
  error: NeedDetail | null;
}

/** The shop's view of one ticket: what it needs and where it stands, never the steps (Q3, D11). */
export interface ShopTicketDTO {
  id: string;
  type: TicketType;
  kind: TicketKind;
  state: ShopState;
  title: string;
  /** An issue's category, which the shop's screen words (Q23); null for a requirement. */
  category: IssueCategory | null;
  /** What the shop fills once it is ready, if the kind has any. */
  names: string[];
  productId: string | null;
  raisedAt: string;
}

/** How a requirement is enabled (Q6): one tap, or a decision among options. Said by its kind. */
export const REQUIREMENT_MODE = { ONE_TAP: "one_tap", DECISION: "decision" } as const;
export type RequirementMode = (typeof REQUIREMENT_MODE)[keyof typeof REQUIREMENT_MODE];

/** A requirement in the admin's inbox: the setup and how many wait, never which shops (Q3, Q4, D11). */
export interface AdminRequirementDTO {
  id: string;
  kind: TicketKind;
  mode: RequirementMode | null;
  status: TicketStatus;
  title: string;
  /** null when one shop waits (Q4). */
  shopsWaiting: number | null;
  reopened: boolean;
  openedAt: string;
}

/** An issue: the developer sees each shop's report and the error that raised it (Q22, Q26). */
export interface AdminIssueDTO {
  id: string;
  status: TicketStatus;
  title: string;
  error: NeedDetail | null;
  reports: Array<{ shop: string; productName: string | null; category: IssueCategory | null; words: string | null; at: string }>;
  reopened: boolean;
  openedAt: string;
}

/** A preview a kind computes; the engine reads only its hash, to refuse a stale Apply (D7). */
export interface PlanBase {
  kind: TicketKind;
  readAt: string;
  hash: string;
}

/** Why a kind could not compute its preview: its own reason, for its own screen to word. */
export interface PlanUnavailableDTO {
  unavailable: string;
}

/** What the admin picked before Apply; the engine checks `hash` and hands the rest to the kind. */
export interface ApplyChoice {
  hash: string;
  [field: string]: unknown;
}
