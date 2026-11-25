import type { SocialError, SocialPlatform } from "./social/types";

/** Our words for a platform's failures, as the inbox reads them off a `SendOutcome`. */
export { SOCIAL_ERROR } from "./social/types";

/**
 * The `ConversationSource` port (social-selling inbox-core D7): what the platform-neutral inbox asks
 * of a platform. inbox-instagram and inbox-whatsapp implement it inside channels, where the token
 * lives; the inbox reaches it only through `conversation-source.service`.
 */

/** What the platform allows a member to send now (D3, Q7). The reply box renders from it; a send re-checks it. */
export const REPLY_WINDOW = {
  /** Reply freely. */
  OPEN: "open",
  /** Only a person may reply, sent tagged (Instagram's human agent, up to day 7; parent Q36). */
  HUMAN_AGENT: "human_agent",
  /** Only an approved, paid template restarts the chat (WhatsApp after 24 hours; parent Q37). */
  TEMPLATE_ONLY: "template_only",
  /** Nothing may be sent until the person writes again. */
  SHUT: "shut",
} as const;
export type ReplyWindowState = (typeof REPLY_WINDOW)[keyof typeof REPLY_WINDOW];

export interface ReplyWindow {
  state: ReplyWindowState;
  /** When the current state ends, if it ends. */
  closesAt: Date | null;
}

/** A free reply (text or picture) goes only in these; a template has its own path. */
export const FREE_REPLY_WINDOWS: readonly ReplyWindowState[] = [REPLY_WINDOW.OPEN, REPLY_WINDOW.HUMAN_AGENT];

/** What a thread's ⋯ may offer, as each platform declares (R7). */
export const CONVERSATION_ACTION = {
  HIDE_COMMENT: "hide_comment",
  UNHIDE_COMMENT: "unhide_comment",
  PRIVATE_REPLY: "private_reply",
  SEND_TEMPLATE: "send_template",
} as const;
export type ConversationAction = (typeof CONVERSATION_ACTION)[keyof typeof CONVERSATION_ACTION];

/** The thread a call is about, in the inbox's own words (inbox-core D1). */
export interface ConversationRef {
  connectionId: string;
  kind: "DM" | "COMMENT";
  /** The platform's id for the person, scoped to the shop. */
  personKey: string;
  /** `dm:<personKey>` or `comment:<top comment id>`. */
  threadKey: string;
  postRef: string | null;
}

export interface OutgoingMessage {
  /** Our row id: WhatsApp carries it back on the status (ADR-0086), which settles an uncertain send. */
  messageId: string;
  conversation: ConversationRef;
  text: string | null;
  /** A public address of a picture from the shop's library. */
  imageUrl: string | null;
  /** The window the send was checked against; a human-agent reply goes tagged. */
  window: ReplyWindowState;
}

export interface WindowInput {
  kind: ConversationRef["kind"];
  lastInboundAt: Date | null;
  now: Date;
}

/**
 * One platform's conversations. A failed call throws `MetaError` (its `SOCIAL_ERROR` code) and a
 * call that may have taken effect throws it as `UNCERTAIN` (ADR-0086); the service turns either into
 * a `SendOutcome`, so the inbox never sees a platform's error.
 */
export interface ConversationSource {
  platform: SocialPlatform;
  window(input: WindowInput): ReplyWindow;
  send(message: OutgoingMessage): Promise<{ platformMessageId: string }>;
  markRead(conversation: ConversationRef, lastPlatformMessageId: string): Promise<void>;
  typing(conversation: ConversationRef): Promise<void>;
  fetchMedia(connectionId: string, attachmentRef: string): Promise<{ bytes: Buffer; mimeType: string | null }>;
  actions(kind: ConversationRef["kind"]): readonly ConversationAction[];
}

/** What came of a send, in words the inbox's state machine takes (A-D8). */
export type SendOutcome =
  | { outcome: "sent"; platformMessageId: string }
  /** Another send holds the account's messages lane: nothing was called; try again shortly. */
  | { outcome: "busy" }
  /** The platform said it did not send. `retryAfterSeconds` when it named a reset. */
  | { outcome: "not-sent"; error: SocialError; retryAfterSeconds: number | null }
  /** It may have gone: never retried blind (ADR-0086). */
  | { outcome: "uncertain" };
