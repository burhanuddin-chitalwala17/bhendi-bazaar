import type { Prisma } from "@prisma/client";

/** The WhatsApp send port, messaging settings and spend (social-selling/whatsapp-sending D1, D4, D6). */

export const SEND_PURPOSE = {
  MARKETING: "MARKETING",
  /** An order update: skips the how-often rule, never consent or spend (R1, parent Q40). */
  UTILITY: "UTILITY",
} as const;
export type SendPurpose = (typeof SEND_PURPOSE)[keyof typeof SEND_PURPOSE];

/** A-D8's state machine, plus Meta's delivery statuses (D2) and the port's own SKIPPED. */
export const WA_SEND_STATE = {
  HELD: "HELD",
  QUEUED: "QUEUED",
  CLAIMED: "CLAIMED",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
  FAILED: "FAILED",
  UNCERTAIN: "UNCERTAIN",
  SKIPPED: "SKIPPED",
} as const;
export type WaSendState = (typeof WA_SEND_STATE)[keyof typeof WA_SEND_STATE];

export const SKIP_REASON = {
  NOT_OPTED_IN: "NOT_OPTED_IN",
  STOPPED: "STOPPED",
  NO_CHANNEL: "NO_CHANNEL",
  /** Past the shop's how-often rule: skipped and counted, never queued (parent Q40). */
  HOW_OFTEN: "HOW_OFTEN",
} as const;
export type SkipReason = (typeof SKIP_REASON)[keyof typeof SKIP_REASON];
export const isSkipReason = (v: string | null): v is SkipReason => Object.values(SKIP_REASON).some((r) => r === v);

export const HELD_REASON = {
  /** This month's spend would cross the shop's limit (Q11). */
  LIMIT: "LIMIT",
  /** The shop has not answered the limit step yet; it is asked before its first paid send (R2). */
  LIMIT_NOT_SET: "LIMIT_NOT_SET",
} as const;
export type HeldReason = (typeof HELD_REASON)[keyof typeof HELD_REASON];
export const isHeldReason = (v: string | null): v is HeldReason => Object.values(HELD_REASON).some((r) => r === v);

export const SEND_OUTCOME = {
  SENT_QUEUED: "SENT_QUEUED",
  SKIPPED: "SKIPPED",
  HELD: "HELD",
} as const;

export const TEMPLATE_LANGUAGE = {
  EN: "EN",
  HI: "HI",
} as const;
export type TemplateLanguage = (typeof TEMPLATE_LANGUAGE)[keyof typeof TEMPLATE_LANGUAGE];

/** Meta's pricing categories; the rate table is keyed by these (D3). */
export const MESSAGE_CATEGORY = {
  MARKETING: "MARKETING",
  UTILITY: "UTILITY",
} as const;
export type MessageCategory = (typeof MESSAGE_CATEGORY)[keyof typeof MESSAGE_CATEGORY];

/** A channel a marketing touch went out on; the how-often rule counts both (parent Q40). */
export const TOUCH_CHANNEL = {
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
} as const;
export type TouchChannel = (typeof TOUCH_CHANNEL)[keyof typeof TOUCH_CHANNEL];

export interface DeliverByWhatsAppInput {
  orgId: string;
  contactId: string;
  /** The shop's template by name and language; U3 resolves it to the approved row. */
  template: { name: string; language: TemplateLanguage };
  /** Values for the template's typed blanks. */
  values: Prisma.InputJsonObject;
  purpose: SendPurpose;
  /** Where the send came from: a campaign, an alert, an order (who did what, parent Q8). */
  sourceRef: string;
  /** The caller's key: a repeat answers the first call's outcome and writes nothing. */
  idempotencyKey: string;
}

export type DeliverAnswer =
  | { outcome: typeof SEND_OUTCOME.SENT_QUEUED; sendId: string; estimatePaise: number }
  | { outcome: typeof SEND_OUTCOME.SKIPPED; sendId: string; reason: SkipReason }
  /** `tellShop` is true on the first hold at the limit in an IST month (D4: told once). */
  | { outcome: typeof SEND_OUTCOME.HELD; sendId: string; reason: HeldReason; tellShop: boolean };

/** Marketing touches a buyer had from a shop, across channels, in the IST day and week (Q12). */
export interface TouchCounts {
  today: number;
  week: number;
}

/** What Send held did: rows queued, skipped on a re-check, and still held at the limit (D4). */
export interface SendHeldResult {
  queued: number;
  skipped: number;
  stillHeld: number;
}

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** "HH:MM" in IST; a closed day is null. */
export interface DayHours {
  open: string;
  close: string;
}
export type ShopHours = Record<Weekday, DayHours | null>;

/** Advanced, each with its default (R8, parent Q112). */
export interface MessagingAdvanced {
  howOftenDay: number;
  howOftenWeek: number;
  greetingDelaySeconds: number;
  botPauseHours: number;
  alertsPerProductPerDay: number;
}

export interface MessagingSettingsDTO extends MessagingAdvanced {
  /** null with `limitSet` true is "No limit"; with `limitSet` false the shop has not answered (R2). */
  limitPaise: number | null;
  limitSet: boolean;
  hours: ShopHours;
  version: number;
}

/** This IST month's spend against the limit (R8): what is reserved for queued sends counts too. */
export interface MonthSpendDTO {
  month: string;
  spentPaise: number;
  reservedPaise: number;
  limitPaise: number | null;
  heldCount: number;
}

/** The lowest limit a shop may set (ux.md: Refused). */
export const MIN_LIMIT_PAISE = 10_000;

export const CAMPAIGNS_COPY = {
  limitTooLow: "The lowest limit is ₹100.",
  closesBeforeOpening: "Closing time must be after opening time.",
  badTime: "Use a time like 10:00.",
  howOftenRange: "Pick between 1 and 7 a week, and no more a day than a week.",
  advancedRange: "That value is out of range.",
  contactNotFound: "Contact not found",
} as const;
