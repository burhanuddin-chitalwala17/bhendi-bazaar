import { MESSAGE_KIND, type FactOf, type MessageKind } from "@server/shared/social-events/facts";
import { INBOX_MESSAGE_KIND, type InboxMessageKind } from "./inbox.types";

/**
 * What one message fact becomes in a thread, before sealing (inbox-core D2, R8); pure. A message carrying
 * several files is one row per file, so nothing it carried is dropped.
 */

/** Our words for what arrived but cannot be shown; WhatsApp's own unknowns come named from the translation. */
export const NAMED_LINE = {
  CONTACTS: "A contact card",
  SHARE: "A shared post",
  STORY_MENTION: "A mention in their story",
  UNKNOWN: "A message that could not be shown here",
} as const;

const SHOWN: Partial<Record<MessageKind, InboxMessageKind>> = {
  [MESSAGE_KIND.TEXT]: INBOX_MESSAGE_KIND.TEXT,
  [MESSAGE_KIND.BUTTON]: INBOX_MESSAGE_KIND.TEXT,
  [MESSAGE_KIND.FORM_REPLY]: INBOX_MESSAGE_KIND.TEXT,
  [MESSAGE_KIND.STORY_REPLY]: INBOX_MESSAGE_KIND.TEXT,
  [MESSAGE_KIND.IMAGE]: INBOX_MESSAGE_KIND.IMAGE,
  [MESSAGE_KIND.VIDEO]: INBOX_MESSAGE_KIND.VIDEO,
  [MESSAGE_KIND.AUDIO]: INBOX_MESSAGE_KIND.AUDIO,
  [MESSAGE_KIND.DOCUMENT]: INBOX_MESSAGE_KIND.DOCUMENT,
  [MESSAGE_KIND.STICKER]: INBOX_MESSAGE_KIND.STICKER,
  [MESSAGE_KIND.LOCATION]: INBOX_MESSAGE_KIND.LOCATION,
};

const NAMED: Partial<Record<MessageKind, string>> = {
  [MESSAGE_KIND.CONTACTS]: NAMED_LINE.CONTACTS,
  [MESSAGE_KIND.SHARE]: NAMED_LINE.SHARE,
  [MESSAGE_KIND.STORY_MENTION]: NAMED_LINE.STORY_MENTION,
};

const FILE_KINDS: ReadonlySet<InboxMessageKind> = new Set([
  INBOX_MESSAGE_KIND.IMAGE,
  INBOX_MESSAGE_KIND.VIDEO,
  INBOX_MESSAGE_KIND.AUDIO,
  INBOX_MESSAGE_KIND.DOCUMENT,
  INBOX_MESSAGE_KIND.STICKER,
]);

export interface MessageRow {
  /** Suffix to the message's dedupe key: empty for the first row, `#2`… for each further file. */
  part: string;
  kind: InboxMessageKind;
  label: string | null;
  text: string | null;
  attachmentRef: string | null;
}

type MessageFact = FactOf<"inbound-message"> | FactOf<"outbound-echo">;

export function messageRows(fact: MessageFact): MessageRow[] {
  const kind = SHOWN[fact.messageKind];
  if (!kind) {
    const label = NAMED[fact.messageKind] ?? fact.unsupportedLabel ?? NAMED_LINE.UNKNOWN;
    return [{ part: "", kind: INBOX_MESSAGE_KIND.UNSUPPORTED, label, text: fact.text, attachmentRef: null }];
  }
  if (!FILE_KINDS.has(kind) || fact.attachments.length === 0) {
    return [{ part: "", kind, label: null, text: fact.text, attachmentRef: null }];
  }
  return fact.attachments.map((file, i) => ({
    part: i === 0 ? "" : `#${i + 1}`,
    kind,
    label: null,
    text: (i === 0 ? fact.text : null) ?? file.caption ?? (kind === INBOX_MESSAGE_KIND.DOCUMENT ? file.fileName : null),
    attachmentRef: file.ref,
  }));
}

/** A list row's preview: the text cut short, or nothing for a row the list names by its kind. */
export function previewOf(text: string | null, chars: number): string | null {
  const flat = text?.replace(/\s+/g, " ").trim();
  if (!flat) return null;
  return flat.length > chars ? `${flat.slice(0, chars - 1)}…` : flat;
}
