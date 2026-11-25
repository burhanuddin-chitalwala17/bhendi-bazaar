import type { Prisma } from "@prisma/client";

/** Bhendi Bazaar's own consents sit beside the shops', under this sender (parent Q27). */
export const PLATFORM_SENDER = "PLATFORM";

/** A shop's org id, or `PLATFORM_SENDER`. */
export type Sender = string;

export const CONSENT_CHANNEL = {
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
} as const;
export type ConsentChannel = (typeof CONSENT_CHANNEL)[keyof typeof CONSENT_CHANNEL];

export const CONSENT_CHANGE = {
  OPT_IN: "OPT_IN",
  STOP: "STOP",
} as const;
export type ConsentChange = (typeof CONSENT_CHANGE)[keyof typeof CONSENT_CHANGE];

/** Stored states only: Not yet is the absence of a row (Q7). */
export const CONSENT_STATE = {
  OPTED_IN: "OPTED_IN",
  STOPPED: "STOPPED",
} as const;
export type ConsentState = (typeof CONSENT_STATE)[keyof typeof CONSENT_STATE];

export const isConsentState = (value: string): value is ConsentState =>
  value === CONSENT_STATE.OPTED_IN || value === CONSENT_STATE.STOPPED;

/** How a change came about; ux.md's history names each one. */
export const CONSENT_SOURCE = {
  CHAT_KEYWORD: "CHAT_KEYWORD",
  CHECKOUT_BOX: "CHECKOUT_BOX",
  FILE_UPLOAD: "FILE_UPLOAD",
  STORE_BUTTON: "STORE_BUTTON",
  FIRST_OFFER: "FIRST_OFFER",
  EMAIL_LINK: "EMAIL_LINK",
} as const;
export type ConsentSource = (typeof CONSENT_SOURCE)[keyof typeof CONSENT_SOURCE];

export const MAY_REASON = {
  NOT_OPTED_IN: "NOT_OPTED_IN",
  STOPPED: "STOPPED",
  NO_CHANNEL: "NO_CHANNEL",
} as const;
export type MayReason = (typeof MAY_REASON)[keyof typeof MAY_REASON];

/** The one answer every sender acts on (consent-core D2). */
export type MayAnswer = { yes: true } | { yes: false; reason: MayReason };

export const CONTACT_SOURCE = {
  CHAT: "CHAT",
  ORDER: "ORDER",
  UPLOAD: "UPLOAD",
  PHONE_SYNC: "PHONE_SYNC",
  STORE_BUTTON: "STORE_BUTTON",
} as const;
export type ContactSource = (typeof CONTACT_SOURCE)[keyof typeof CONTACT_SOURCE];

export const NAME_SOURCE = {
  TYPED: "TYPED",
  SYNCED: "SYNCED",
  PLATFORM: "PLATFORM",
} as const;
export type NameSource = (typeof NAME_SOURCE)[keyof typeof NAME_SOURCE];

export const CONTACT_LANGUAGE = {
  EN: "EN",
  HI: "HI",
} as const;
export type ContactLanguage = (typeof CONTACT_LANGUAGE)[keyof typeof CONTACT_LANGUAGE];

/** What `may` needs of a contact: whose it is and where it can be reached. */
export interface ContactReach {
  orgId: string;
  phoneE164: string | null;
  bsuid: string | null;
  email: string | null;
}

export interface ConsentChangeInput {
  sender: Sender;
  contactId: string;
  channel: ConsentChannel;
  source: ConsentSource;
  /** The order id, inbound message id, file or attestation that proves it (Q7). */
  evidence: Prisma.InputJsonObject;
}

/** `changed: false` when the state already held, or an upload met a STOP (R5). */
export interface ConsentChangeResult {
  changed: boolean;
  state: ConsentState | null;
}

/** One line of a contact's history, newest first (ux.md: History). */
export interface ConsentHistoryEntryDTO {
  channel: ConsentChannel;
  change: ConsentChange;
  source: ConsentSource;
  evidence: Prisma.JsonValue;
  at: Date;
}
