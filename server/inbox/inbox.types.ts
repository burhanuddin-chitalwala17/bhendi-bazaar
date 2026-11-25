/** The inbox's closed sets (social-selling inbox-core D1). Stored as strings; compared only by these constants. */

export const CONVERSATION_KIND = {
  DM: "DM",
  COMMENT: "COMMENT",
} as const;
export type ConversationKind = (typeof CONVERSATION_KIND)[keyof typeof CONVERSATION_KIND];

export const MESSAGE_DIRECTION = {
  IN: "IN",
  OUT: "OUT",
} as const;
export type MessageDirection = (typeof MESSAGE_DIRECTION)[keyof typeof MESSAGE_DIRECTION];

/** Who wrote it: a member here, an automatic reply, the shop in the platform's own app, or the person (R3). */
export const MESSAGE_AUTHOR = {
  MEMBER: "MEMBER",
  AUTOMATIC: "AUTOMATIC",
  APP: "APP",
  PERSON: "PERSON",
} as const;
export type MessageAuthor = (typeof MESSAGE_AUTHOR)[keyof typeof MESSAGE_AUTHOR];

export const INBOX_MESSAGE_KIND = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
  DOCUMENT: "DOCUMENT",
  LOCATION: "LOCATION",
  STICKER: "STICKER",
  CART: "CART",
  TEMPLATE: "TEMPLATE",
  /** Shown as a line naming what it was (R8): the row's `label`. */
  UNSUPPORTED: "UNSUPPORTED",
  EDIT: "EDIT",
  REACTION: "REACTION",
} as const;
export type InboxMessageKind = (typeof INBOX_MESSAGE_KIND)[keyof typeof INBOX_MESSAGE_KIND];

/** An outbound row's life (A-D8, ADR-0086). What the person sent has no state. */
export const MESSAGE_STATE = {
  HELD: "HELD",
  QUEUED: "QUEUED",
  CLAIMED: "CLAIMED",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
  FAILED: "FAILED",
  UNCERTAIN: "UNCERTAIN",
  CANCELLED: "CANCELLED",
} as const;
export type MessageState = (typeof MESSAGE_STATE)[keyof typeof MESSAGE_STATE];

/**
 * How far a send has got, for statuses that arrive in any order (D2): a status only ever raises a row.
 * FAILED outranks SENT (Meta can fail a sent message) but never a delivered one. A held or cancelled row
 * is ours alone and no status touches it.
 */
export const STATE_RANK: Partial<Record<MessageState, number>> = {
  [MESSAGE_STATE.QUEUED]: 1,
  [MESSAGE_STATE.CLAIMED]: 2,
  [MESSAGE_STATE.UNCERTAIN]: 3,
  [MESSAGE_STATE.SENT]: 4,
  [MESSAGE_STATE.FAILED]: 5,
  [MESSAGE_STATE.DELIVERED]: 6,
  [MESSAGE_STATE.READ]: 7,
};

/** The states a status of this rank may move a row out of. */
export function statesBelow(state: MessageState): MessageState[] {
  const rank = STATE_RANK[state] ?? 0;
  return (Object.keys(STATE_RANK) as MessageState[]).filter((s) => (STATE_RANK[s] ?? 0) < rank);
}

/** `Conversation.sortRank`: one index serves "Needs you first" (D1). */
export const SORT_RANK = { NEEDS_YOU: 0, OTHER: 1 } as const;

/** A list row's preview is cut to this many characters before it is sealed. */
export const PREVIEW_CHARS = 120;

/** Why a thread needs the shop (D5): an automatic reply handed it over, or met a question it could not answer. */
export const NEEDS_YOU_REASON = {
  HANDOVER: "handover",
  UNANSWERABLE: "unanswerable",
} as const;
export type NeedsYouReason = (typeof NEEDS_YOU_REASON)[keyof typeof NEEDS_YOU_REASON];
