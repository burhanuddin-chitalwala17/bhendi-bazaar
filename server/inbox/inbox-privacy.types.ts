/** What the shop's privacy sheet and support's one open carry (inbox-core D9, R14). Never a message body for the shop's log. */

/** Sharing lasts this long (parent Q116). */
export const SUPPORT_SHARE_HOURS = 48;

export interface SupportShareDTO {
  conversationId: string;
  requestId: string;
  until: string;
}

/** One line of "Who has opened your chats": support, which chat, when. */
export interface ChatOpenDTO {
  id: string;
  at: string;
  conversationId: string;
  /** The person's name, handle or number; null once the chat itself is deleted. */
  person: string | null;
}

export interface InboxPrivacyDTO {
  opens: ChatOpenDTO[];
  shares: Array<SupportShareDTO & { person: string | null }>;
}

/** A message as support sees it while a share is live. */
export interface SharedMessageDTO {
  id: string;
  direction: string;
  author: string;
  kind: string;
  label: string | null;
  body: string | null;
  sentAt: string | null;
}
