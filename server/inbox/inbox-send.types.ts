import type { MessageState } from "./inbox.types";

/** Sending from the inbox (social-selling inbox-core D6; spec R5, R9; decisions Q9, Q16). */

/** Instagram's text cap, applied to every platform (Q5). */
export const REPLY_TEXT_MAX = 1_000;
/** What a member sends waits this long, with Undo (Q16). */
export const HOLD_SECONDS = 7;
/** Automatic replies pause in a thread a member answered (enquiry-autoreplies R7; its default, enquiry Q5). */
export const BOT_PAUSE_HOURS = 12;
/** A send that found the account's lane busy looks again after this. */
export const BUSY_RETRY_SECONDS = 2;
/** The one automatic retry of a not-sent error waits this long, or the platform's own reset (Q9). */
export const AUTO_RETRY_SECONDS = 5;
/** First try plus the one automatic retry (Q9). */
export const MAX_AUTO_ATTEMPTS = 2;

/** A reply as the thread shows it right after Send, Undo or Try again. */
export interface SentReplyDTO {
  id: string;
  state: MessageState;
  /** When a held reply goes, ISO; the countdown is display only, the row's state is the truth. */
  sendAfter: string | null;
}

/** What Undo puts back in the box. */
export interface UndoneReplyDTO {
  text: string;
  mediaId: string | null;
}

export const INBOX_SEND_COPY = {
  conversationNotFound: "This conversation isn't in your inbox.",
  messageNotFound: "This message isn't in your inbox.",
  platformNotReady: "Replies to this platform aren't open yet.",
  windowShut: "The platform doesn't allow a reply here right now.",
  mediaNotInLibrary: "Pick a picture from your library.",
  alreadySent: "Too late to undo: it has gone.",
  notFailed: "Only a message that wasn't sent can be tried again.",
} as const;
